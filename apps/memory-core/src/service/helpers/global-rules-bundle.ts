import type { PrismaClient } from '@prisma/client';
import type { AuthContext } from '../../auth.js';
import type { EffectiveWorkspaceSettings } from '../workspace-resolution.js';
import {
  buildRulesSummaryText,
  selectRulesWithinBudget,
  type RoutingMode,
  type RoutingScoreBreakdown,
  type RuleScope,
  type SelectedRule,
  type SelectionMode,
} from './global-rules-selection.js';

type WorkspaceRef = { id: string; key: string };

type RuleSeverity = 'low' | 'medium' | 'high';
type RuleCategory = 'policy' | 'security' | 'style' | 'process' | 'other';

type RuleRecord = {
  id: string;
  title: string;
  content: string;
  category: RuleCategory;
  priority: number;
  severity: RuleSeverity;
  pinned: boolean;
  enabled: boolean;
  tags: unknown;
  usageCount: number;
  lastRoutedAt: Date | null;
  updatedAt: Date;
};

export async function buildGlobalRulesBundle(args: {
  prisma: PrismaClient;
  auth: AuthContext;
  workspace: WorkspaceRef;
  settings: EffectiveWorkspaceSettings;
  totalBudget?: number;
  queryText?: string;
  contextHintText?: string;
  includeRoutingDebug?: boolean;
}): Promise<{
  workspace_rules: SelectedRule[];
  user_rules: SelectedRule[];
  workspace_summary?: string;
  user_summary?: string;
  routing: {
    mode: RoutingMode;
    q_used?: string;
    selected_rule_ids: string[];
    dropped_rule_ids: string[];
    score_breakdown?: RoutingScoreBreakdown[];
  };
  warnings: Array<{ level: 'info' | 'warn'; message: string }>;
  debug: {
    workspace_budget_tokens: number;
    user_budget_tokens: number;
    workspace_selected_count: number;
    user_selected_count: number;
    workspace_omitted_count: number;
    user_omitted_count: number;
    selection_mode: SelectionMode;
    routing_enabled: boolean;
    routing_mode: RoutingMode;
    routing_top_k: number;
    routing_min_score: number;
    q_used?: string;
  };
}> {
  const totalBudget = clampInt(
    Number(args.totalBudget ?? args.settings.bundleTokenBudgetTotal),
    args.settings.bundleTokenBudgetTotal,
    100,
    50000
  );
  const workspaceBudget = Math.max(
    50,
    Math.floor(totalBudget * args.settings.bundleBudgetGlobalWorkspacePct)
  );
  const userBudget = Math.max(
    30,
    Math.floor(totalBudget * args.settings.bundleBudgetGlobalUserPct)
  );
  const explicitQuery = String(args.queryText || '').trim();
  const contextHint = String(args.contextHintText || '').trim();
  const qUsed = explicitQuery || contextHint;
  const routingMode: RoutingMode = args.settings.globalRulesRoutingMode;
  const routingEnabled = args.settings.globalRulesRoutingEnabled === true;

  const [workspaceRules, userRules, workspaceSummaryRow, userSummaryRow] = await Promise.all([
    args.prisma.globalRule.findMany({
      where: {
        workspaceId: args.workspace.id,
        scope: 'workspace',
        enabled: true,
      },
      orderBy: [{ pinned: 'desc' }, { severity: 'desc' }, { priority: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        priority: true,
        severity: true,
        pinned: true,
        enabled: true,
        tags: true,
        usageCount: true,
        lastRoutedAt: true,
        updatedAt: true,
      },
    }),
    args.prisma.globalRule.findMany({
      where: {
        workspaceId: args.workspace.id,
        scope: 'user',
        userId: args.auth.user.id,
        enabled: true,
      },
      orderBy: [{ pinned: 'desc' }, { severity: 'desc' }, { priority: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        priority: true,
        severity: true,
        pinned: true,
        enabled: true,
        tags: true,
        usageCount: true,
        lastRoutedAt: true,
        updatedAt: true,
      },
    }),
    args.prisma.globalRuleSummary.findFirst({
      where: {
        workspaceId: args.workspace.id,
        scope: 'workspace',
      },
      orderBy: [{ updatedAt: 'desc' }],
      select: { summary: true },
    }),
    args.prisma.globalRuleSummary.findFirst({
      where: {
        workspaceId: args.workspace.id,
        scope: 'user',
        userId: args.auth.user.id,
      },
      orderBy: [{ updatedAt: 'desc' }],
      select: { summary: true },
    }),
  ]);

  const selectionMode = args.settings.globalRulesSelectionMode;
  const workspaceSelectionRules = workspaceRules.map((rule) => ({
    ...rule,
    tags: normalizeTags(rule.tags),
  }));
  const userSelectionRules = userRules.map((rule) => ({
    ...rule,
    tags: normalizeTags(rule.tags),
  }));
  const workspaceSelection = selectRulesWithinBudget({
    rules: workspaceSelectionRules,
    budgetTokens: workspaceBudget,
    selectionMode,
    recommendMax: args.settings.globalRulesRecommendMax,
    warnThreshold: args.settings.globalRulesWarnThreshold,
    summaryEnabled: args.settings.globalRulesSummaryEnabled,
    summaryMinCount: args.settings.globalRulesSummaryMinCount,
    scope: 'workspace',
    routing: {
      enabled: routingEnabled,
      mode: routingMode,
      query: qUsed,
      topK: args.settings.globalRulesRoutingTopK,
      minScore: args.settings.globalRulesRoutingMinScore,
    },
  });
  const userSelection = selectRulesWithinBudget({
    rules: userSelectionRules,
    budgetTokens: userBudget,
    selectionMode,
    recommendMax: args.settings.globalRulesRecommendMax,
    warnThreshold: args.settings.globalRulesWarnThreshold,
    summaryEnabled: args.settings.globalRulesSummaryEnabled,
    summaryMinCount: args.settings.globalRulesSummaryMinCount,
    scope: 'user',
    routing: {
      enabled: routingEnabled,
      mode: routingMode,
      query: qUsed,
      topK: args.settings.globalRulesRoutingTopK,
      minScore: args.settings.globalRulesRoutingMinScore,
    },
  });

  const workspaceSummary =
    workspaceSelection.usedSummary && args.settings.globalRulesSummaryEnabled
      ? workspaceSummaryRow?.summary ||
        buildRulesSummaryText({
          scope: 'workspace',
          rules: workspaceRules,
        })
      : undefined;

  const userSummary =
    userSelection.usedSummary && args.settings.globalRulesSummaryEnabled
      ? userSummaryRow?.summary ||
        buildRulesSummaryText({
          scope: 'user',
          rules: userRules,
        })
      : undefined;

  const selectedRuleIds = [
    ...workspaceSelection.selected.map((rule) => rule.id),
    ...userSelection.selected.map((rule) => rule.id),
  ];
  const selectedIdSet = new Set(selectedRuleIds);
  const droppedRuleIds = [...workspaceRules, ...userRules]
    .map((rule) => rule.id)
    .filter((id) => !selectedIdSet.has(id));
  const routingScoreBreakdown = [
    ...(workspaceSelection.routing?.scoreBreakdown || []),
    ...(userSelection.routing?.scoreBreakdown || []),
  ];

  if (routingEnabled && qUsed && selectedRuleIds.length > 0) {
    await args.prisma.globalRule.updateMany({
      where: {
        id: {
          in: selectedRuleIds,
        },
      },
      data: {
        lastRoutedAt: new Date(),
        usageCount: {
          increment: 1,
        },
      },
    });
  }

  return {
    workspace_rules: workspaceSelection.selected,
    user_rules: userSelection.selected,
    workspace_summary: workspaceSummary,
    user_summary: userSummary,
    routing: {
      mode: routingMode,
      q_used: qUsed || undefined,
      selected_rule_ids: selectedRuleIds,
      dropped_rule_ids: droppedRuleIds,
      score_breakdown: args.includeRoutingDebug ? routingScoreBreakdown : undefined,
    },
    warnings: [...workspaceSelection.warnings, ...userSelection.warnings],
    debug: {
      workspace_budget_tokens: workspaceBudget,
      user_budget_tokens: userBudget,
      workspace_selected_count: workspaceSelection.selected.length,
      user_selected_count: userSelection.selected.length,
      workspace_omitted_count: workspaceSelection.omittedCount,
      user_omitted_count: userSelection.omittedCount,
      selection_mode: selectionMode,
      routing_enabled: routingEnabled,
      routing_mode: routingMode,
      routing_top_k: args.settings.globalRulesRoutingTopK,
      routing_min_score: args.settings.globalRulesRoutingMinScore,
      q_used: qUsed || undefined,
    },
  };
}

function normalizeTags(input: unknown): string[] {
  const source = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[,\n]/g)
      : [];
  const tags = source
    .map((item) => String(item || '').trim().toLowerCase())
    .map((item) => item.replace(/\s+/g, '-'))
    .filter((item) => item.length > 0 && item.length <= 64);
  return Array.from(new Set(tags)).slice(0, 100);
}

function clampInt(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(Math.round(value), min), max);
}
