export type RuleScope = 'workspace' | 'user';
export type RuleCategory = 'policy' | 'security' | 'style' | 'process' | 'other';
export type RuleSeverity = 'low' | 'medium' | 'high';
export type SelectionMode = 'score' | 'recent' | 'priority_only';
export type RoutingMode = 'semantic' | 'keyword' | 'hybrid';

type RuleForSelection = {
  id: string;
  title: string;
  content: string;
  category: RuleCategory;
  priority: number;
  severity: RuleSeverity;
  pinned: boolean;
  enabled: boolean;
  tags: string[];
  usageCount: number;
  updatedAt: Date;
};

export type RoutingScoreBreakdown = {
  rule_id: string;
  scope: RuleScope;
  semantic: number;
  keyword: number;
  priority: number;
  recency: number;
  length_penalty: number;
  final: number;
  selected: boolean;
  reason: string;
};

export type SelectedRule = {
  id: string;
  title: string;
  content: string;
  category: RuleCategory;
  priority: number;
  severity: RuleSeverity;
  pinned: boolean;
  token_estimate: number;
  selected_reason: string;
  score?: number;
};

export type RuleSelectionResult = {
  selected: SelectedRule[];
  omittedCount: number;
  warnings: Array<{ level: 'info' | 'warn'; message: string }>;
  usedSummary: boolean;
  summaryReason?: string;
  routing?: {
    mode: RoutingMode;
    qUsed?: string;
    selectedRuleIds: string[];
    droppedRuleIds: string[];
    scoreBreakdown: RoutingScoreBreakdown[];
  };
};

export function selectRulesWithinBudget(args: {
  rules: RuleForSelection[];
  budgetTokens: number;
  selectionMode: SelectionMode;
  recommendMax: number;
  warnThreshold: number;
  summaryEnabled: boolean;
  summaryMinCount: number;
  scope: RuleScope;
  routing?: {
    enabled: boolean;
    mode: RoutingMode;
    query?: string;
    topK: number;
    minScore: number;
  };
}): RuleSelectionResult {
  const budget = clampInt(args.budgetTokens, 300, 100, 50000);
  const enabledRules = args.rules.filter((rule) => rule.enabled);
  const warnings: Array<{ level: 'info' | 'warn'; message: string }> = [];

  if (enabledRules.length > args.recommendMax) {
    warnings.push({
      level: 'info',
      message: `Recommended: keep ≤ ${args.recommendMax} core rules for better context focus.`,
    });
  }
  if (enabledRules.length >= args.warnThreshold) {
    warnings.push({
      level: 'warn',
      message: `${enabledRules.length} active rules may reduce context clarity. Consider summarize/compression.`,
    });
  }

  const selected: SelectedRule[] = [];
  const selectedIds = new Set<string>();
  let spent = 0;

  const pinned = enabledRules.filter((rule) => rule.pinned);
  const high = enabledRules.filter((rule) => !rule.pinned && rule.severity === 'high');

  for (const rule of pinned) {
    const tokenEstimate = estimateTokens(`${rule.title}\n${rule.content}`);
    selected.push({
      id: rule.id,
      title: rule.title,
      content: rule.content,
      category: rule.category,
      priority: rule.priority,
      severity: rule.severity,
      pinned: rule.pinned,
      token_estimate: tokenEstimate,
      selected_reason: 'pinned',
      score: scoreRule(rule),
    });
    spent += tokenEstimate;
    selectedIds.add(rule.id);
  }

  let highDroppedForBudget = 0;
  for (const rule of high) {
    const tokenEstimate = estimateTokens(`${rule.title}\n${rule.content}`);
    if (spent + tokenEstimate > budget && pinned.length > 0) {
      highDroppedForBudget += 1;
      continue;
    }
    selected.push({
      id: rule.id,
      title: rule.title,
      content: rule.content,
      category: rule.category,
      priority: rule.priority,
      severity: rule.severity,
      pinned: rule.pinned,
      token_estimate: tokenEstimate,
      selected_reason: 'high_severity',
      score: scoreRule(rule),
    });
    spent += tokenEstimate;
    selectedIds.add(rule.id);
  }

  if (spent > budget) {
    warnings.push({
      level: 'warn',
      message: `Pinned rules exceed the global budget (${spent}/${budget} tokens). Consider consolidating pinned rules.`,
    });
  }
  if (highDroppedForBudget > 0) {
    warnings.push({
      level: 'warn',
      message: `${highDroppedForBudget} high-severity rules could not fit budget after pinned rules and were compressed into summary.`,
    });
  }

  const remaining = enabledRules.filter((rule) => !selectedIds.has(rule.id));
  const scoreByRuleId = new Map<string, number>();
  const routedIds = new Set<string>();
  const routingBreakdownByRuleId = new Map<string, RoutingScoreBreakdown>();

  const routingEnabled = args.routing?.enabled === true;
  const qUsed = String(args.routing?.query || '').trim();
  if (routingEnabled && qUsed) {
    const queryTokens = tokenizeForRouting(qUsed);
    if (queryTokens.length > 0) {
      const routingScores = remaining.map((rule) =>
        computeRoutingBreakdown({
          scope: args.scope,
          rule,
          queryTokens,
          mode: args.routing?.mode || 'hybrid',
        })
      );
      for (const score of routingScores) {
        routingBreakdownByRuleId.set(score.rule_id, score);
        scoreByRuleId.set(score.rule_id, score.final);
      }
      routingScores
        .filter((score) => score.final >= (args.routing?.minScore ?? 0.2))
        .sort((left, right) => right.final - left.final)
        .slice(0, Math.max(1, args.routing?.topK || 5))
        .forEach((score) => {
          routedIds.add(score.rule_id);
        });
    }
  }

  const sorted = [...remaining].sort((a, b) => {
    if (args.selectionMode === 'recent') {
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    }
    if (args.selectionMode === 'priority_only') {
      return a.priority - b.priority || b.updatedAt.getTime() - a.updatedAt.getTime();
    }
    return scoreRule(b) - scoreRule(a) || b.updatedAt.getTime() - a.updatedAt.getTime();
  });
  const routedSorted = sorted.filter((rule) => routedIds.has(rule.id)).sort((left, right) => {
    return (scoreByRuleId.get(right.id) || 0) - (scoreByRuleId.get(left.id) || 0);
  });
  const fallbackSorted = sorted.filter((rule) => !routedIds.has(rule.id));
  const finalOrder = [...routedSorted, ...fallbackSorted];

  for (const rule of finalOrder) {
    const tokenEstimate = estimateTokens(`${rule.title}\n${rule.content}`);
    if (spent + tokenEstimate > budget) {
      continue;
    }
    const breakdown = routingBreakdownByRuleId.get(rule.id);
    if (breakdown) {
      breakdown.selected = true;
      breakdown.reason = routedIds.has(rule.id)
        ? `routing_${args.routing?.mode || 'hybrid'}`
        : 'budget_fallback';
    }
    selected.push({
      id: rule.id,
      title: rule.title,
      content: rule.content,
      category: rule.category,
      priority: rule.priority,
      severity: rule.severity,
      pinned: rule.pinned,
      token_estimate: tokenEstimate,
      selected_reason:
        routedIds.has(rule.id)
          ? `routing_${args.routing?.mode || 'hybrid'}`
          : args.selectionMode === 'priority_only'
            ? 'priority'
            : args.selectionMode === 'recent'
              ? 'recent'
              : 'score',
      score: scoreByRuleId.get(rule.id) ?? scoreRule(rule),
    });
    spent += tokenEstimate;
    selectedIds.add(rule.id);
  }

  const omittedCount = enabledRules.length - selected.length;
  const usedSummary =
    args.summaryEnabled && enabledRules.length >= args.summaryMinCount && omittedCount > 0;

  return {
    selected,
    omittedCount,
    warnings,
    usedSummary,
    summaryReason: usedSummary ? 'rule_count_or_budget' : undefined,
    routing:
      routingEnabled && qUsed
        ? {
            mode: args.routing?.mode || 'hybrid',
            qUsed,
            selectedRuleIds: selected.map((rule) => rule.id),
            droppedRuleIds: enabledRules
              .map((rule) => rule.id)
              .filter((ruleId) => !selectedIds.has(ruleId)),
            scoreBreakdown: Array.from(routingBreakdownByRuleId.values()),
          }
        : undefined,
  };
}

export function buildRulesSummaryText(args: {
  scope: RuleScope;
  rules: Array<{
    title: string;
    content: string;
    category: RuleCategory;
    severity: RuleSeverity;
    priority: number;
    pinned: boolean;
  }>;
}): string {
  const header =
    args.scope === 'workspace'
      ? 'Workspace Global Rules Summary'
      : 'User Global Rules Summary';
  const lines = args.rules.slice(0, 20).map((rule) => {
    const tags = [`${rule.category}`, `${rule.severity}`, `p${rule.priority}`];
    if (rule.pinned) {
      tags.push('pinned');
    }
    return `- [${tags.join('|')}] ${rule.title}: ${summarizeInline(rule.content, 180)}`;
  });
  return `${header}\n${lines.join('\n') || '- No active rules.'}`;
}

function estimateTokens(text: string): number {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 1;
  }
  return Math.max(1, Math.ceil(normalized.length / 4));
}

function summarizeInline(text: string, maxChars = 140): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '-';
  }
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(maxChars - 3, 1)).trimEnd()}...`;
}

function scoreRule(rule: RuleForSelection): number {
  const priorityWeight = (6 - clampInt(rule.priority, 3, 1, 5)) * 2;
  const ageDays = Math.max((Date.now() - rule.updatedAt.getTime()) / (24 * 60 * 60 * 1000), 0);
  const recencyWeight = Math.max(0, 10 - ageDays / 3);
  const usageWeight = Math.min(Math.max(rule.usageCount || 0, 0), 100) * 0.05;
  const lengthPenalty = estimateTokens(rule.content) / 250;
  return priorityWeight + recencyWeight + usageWeight - lengthPenalty;
}

function tokenizeForRouting(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 512);
}

function toFrequencyMap(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const token of tokens) {
    map.set(token, (map.get(token) || 0) + 1);
  }
  return map;
}

function cosineSimilarity(queryTokens: string[], documentTokens: string[]): number {
  if (queryTokens.length === 0 || documentTokens.length === 0) {
    return 0;
  }
  const left = toFrequencyMap(queryTokens);
  const right = toFrequencyMap(documentTokens);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (const value of left.values()) {
    leftNorm += value * value;
  }
  for (const value of right.values()) {
    rightNorm += value * value;
  }
  for (const [token, leftValue] of left.entries()) {
    const rightValue = right.get(token);
    if (rightValue) {
      dot += leftValue * rightValue;
    }
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }
  return dot / Math.sqrt(leftNorm * rightNorm);
}

function keywordOverlapScore(queryTokens: string[], ruleTokens: string[]): number {
  if (queryTokens.length === 0 || ruleTokens.length === 0) {
    return 0;
  }
  const querySet = new Set(queryTokens);
  const ruleSet = new Set(ruleTokens);
  let overlap = 0;
  for (const token of querySet) {
    if (ruleSet.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(querySet.size, 1);
}

function computeRoutingBreakdown(args: {
  scope: RuleScope;
  rule: RuleForSelection;
  queryTokens: string[];
  mode: RoutingMode;
}): RoutingScoreBreakdown {
  const joinedRuleText = `${args.rule.title} ${args.rule.content} ${args.rule.tags.join(' ')}`;
  const ruleTokens = tokenizeForRouting(joinedRuleText);
  const semantic = cosineSimilarity(args.queryTokens, ruleTokens);
  const keyword = keywordOverlapScore(args.queryTokens, ruleTokens);
  const priority = (6 - clampInt(args.rule.priority, 3, 1, 5)) / 5;
  const ageDays = Math.max((Date.now() - args.rule.updatedAt.getTime()) / (24 * 60 * 60 * 1000), 0);
  const recency = Math.exp(-ageDays / 21);
  const lengthPenalty = Math.min(estimateTokens(args.rule.content) / 800, 0.6);

  const semanticWeight = args.mode === 'semantic' ? 1 : args.mode === 'keyword' ? 0 : 0.65;
  const keywordWeight = args.mode === 'keyword' ? 1 : args.mode === 'semantic' ? 0 : 0.35;
  const final =
    semantic * semanticWeight +
    keyword * keywordWeight +
    priority * 0.2 +
    recency * 0.12 -
    lengthPenalty * 0.08;

  return {
    rule_id: args.rule.id,
    scope: args.scope,
    semantic: Number(semantic.toFixed(6)),
    keyword: Number(keyword.toFixed(6)),
    priority: Number(priority.toFixed(6)),
    recency: Number(recency.toFixed(6)),
    length_penalty: Number(lengthPenalty.toFixed(6)),
    final: Number(final.toFixed(6)),
    selected: false,
    reason: '',
  };
}

function clampInt(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(Math.round(value), min), max);
}
