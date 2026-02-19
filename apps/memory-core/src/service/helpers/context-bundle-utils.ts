import { contextPersonaSchema, defaultPersonaWeights } from '@claustrum/shared';

export type PersonaRecommendation = {
  recommended: 'neutral' | 'author' | 'reviewer' | 'architect';
  confidence: number;
  reasons: string[];
  alternatives: Array<{ persona: 'neutral' | 'author' | 'reviewer' | 'architect'; score: number }>;
};

export function recommendContextPersona(args: {
  query?: string;
  contextHint?: string;
  allowContextFallback: boolean;
}): PersonaRecommendation {
  const sourceText = String(args.query || '').trim();
  const fallbackText = String(args.contextHint || '').trim();
  const text = sourceText || (args.allowContextFallback ? fallbackText : '');
  if (!text) {
    return {
      recommended: 'neutral',
      confidence: 0.45,
      reasons: ['No explicit query signal; neutral is the safest default.'],
      alternatives: [
        { persona: 'neutral', score: 0.45 },
        { persona: 'author', score: 0.2 },
        { persona: 'reviewer', score: 0.2 },
        { persona: 'architect', score: 0.2 },
      ],
    };
  }

  const normalized = text.toLowerCase();
  const scoreByPersona: Record<'neutral' | 'author' | 'reviewer' | 'architect', number> = {
    neutral: 0.45,
    author: 0.2,
    reviewer: 0.2,
    architect: 0.2,
  };
  const reasons: string[] = [];

  const authorSignals = ['implement', 'fix', 'build', 'add', 'refactor', 'write', 'ship', 'patch'];
  const reviewerSignals = ['review', 'security', 'permission', 'audit', 'risk', 'validate', 'check'];
  const architectSignals = ['architecture', 'design', 'scal', 'system', 'tradeoff', 'boundary', 'platform'];

  const authorHits = countSignalHits(normalized, authorSignals);
  const reviewerHits = countSignalHits(normalized, reviewerSignals);
  const architectHits = countSignalHits(normalized, architectSignals);

  scoreByPersona.author += authorHits * 0.45;
  scoreByPersona.reviewer += reviewerHits * 0.5;
  scoreByPersona.architect += architectHits * 0.5;

  if (reviewerHits > 0) {
    reasons.push('Mentions security/permission/audit concerns.');
  }
  if (architectHits > 0) {
    reasons.push('Mentions architecture/design/scaling concerns.');
  }
  if (authorHits > 0) {
    reasons.push('Mentions implementation/fix/add execution work.');
  }

  if (reviewerHits === 0 && architectHits === 0 && authorHits === 0) {
    scoreByPersona.neutral += 0.25;
    reasons.push('No strong persona keyword match; using balanced neutral mode.');
  }

  const alternatives = (
    Object.entries(scoreByPersona) as Array<['neutral' | 'author' | 'reviewer' | 'architect', number]>
  )
    .sort((a, b) => b[1] - a[1])
    .map(([persona, score]) => ({ persona, score: Number(score.toFixed(3)) }));

  const [top, second] = alternatives;
  const confidence = Number(
    clamp(
      0.45 + Math.max(0, (top?.score || 0) - (second?.score || 0)) * 0.45,
      0.45,
      0.98
    ).toFixed(3)
  );

  return {
    recommended: top?.persona || 'neutral',
    confidence,
    reasons: reasons.slice(0, 3),
    alternatives,
  };
}

export function resolveContextPersona(input: unknown): 'neutral' | 'author' | 'reviewer' | 'architect' {
  const parsed = contextPersonaSchema.safeParse(input);
  if (!parsed.success) {
    return 'neutral';
  }
  return parsed.data;
}

export function resolvePersonaWeights(
  input: unknown,
  persona: 'neutral' | 'author' | 'reviewer' | 'architect'
): Record<string, number> {
  const fallback = {
    ...(defaultPersonaWeights.neutral as Record<string, number>),
    ...((defaultPersonaWeights[persona] || {}) as Record<string, number>),
  };

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fallback;
  }
  const root = input as Record<string, unknown>;
  const merged: Record<string, number> = { ...fallback };
  const overrides = root[persona];
  if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
    for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
      const normalizedKey = String(key || '').trim().toLowerCase();
      const numeric = Number(value);
      if (!normalizedKey || !Number.isFinite(numeric) || numeric <= 0) {
        continue;
      }
      merged[normalizedKey] = Math.min(numeric, 100);
    }
  }
  return merged;
}

export function applyPersonaWeightsToRetrievalRows(args: {
  rows: Array<Record<string, unknown>>;
  personaWeights: Record<string, number>;
  includeDebug: boolean;
}): Array<Record<string, unknown>> {
  if (args.rows.length <= 1) {
    return args.rows;
  }
  const weighted = args.rows.map((row, index) => {
    const type = asString(row.type).toLowerCase();
    const scoreBreakdown = toRecord(row.score_breakdown);
    const baseScore =
      asOptionalNumber(scoreBreakdown?.final) ??
      asOptionalNumber(row.score) ??
      Math.max(0.0001, (args.rows.length - index) / args.rows.length);
    const personaWeight = args.personaWeights[type] ?? args.personaWeights.default ?? 1;
    const adjustedScore = baseScore * personaWeight;
    return {
      ...row,
      __base_score: baseScore,
      __adjusted_score: adjustedScore,
      __persona_weight: personaWeight,
      ...(args.includeDebug
        ? {
            persona_adjustment: {
              base_score: Number(baseScore.toFixed(6)),
              persona_weight: Number(personaWeight.toFixed(6)),
              adjusted_score: Number(adjustedScore.toFixed(6)),
            },
          }
        : {}),
    };
  });

  weighted.sort((a, b) => {
    const scoreA = asOptionalNumber(a.__adjusted_score) ?? 0;
    const scoreB = asOptionalNumber(b.__adjusted_score) ?? 0;
    return scoreB - scoreA;
  });

  return weighted;
}

export function buildAppliedTypeSummary(rows: Array<Record<string, unknown>>): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const row of rows) {
    const type = asString(row.type).toLowerCase();
    if (!type) {
      continue;
    }
    const weight = asOptionalNumber(row.__persona_weight) ?? 1;
    summary[type] = Number(weight.toFixed(3));
  }
  return summary;
}

export function extractDecisionSummary(content: string): string {
  const lines = content.split('\n').map((line) => line.trim());
  const summaryHeaderIndex = lines.findIndex((line) => line === 'Summary:' || line.startsWith('Summary:'));
  if (summaryHeaderIndex >= 0) {
    const inline = lines[summaryHeaderIndex].replace(/^Summary:\s*/, '').trim();
    if (inline) {
      return inline;
    }
    const next = lines.slice(summaryHeaderIndex + 1).find((line) => line.length > 0 && !line.endsWith(':'));
    if (next) {
      return trimSnippet(next, 200);
    }
  }
  return trimSnippet(content, 200);
}

export function snippetFromMemory(row: Record<string, unknown>, maxChars: number): string {
  return trimSnippet(asString(row.content), maxChars);
}

export function trimSnippet(input: string, maxChars: number): string {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(maxChars - 3, 1)).trimEnd()}...`;
}

export function extractSubpathFromMetadata(metadata: unknown): string | undefined {
  const record = toRecord(metadata);
  const raw = record?.subpath;
  const normalized = normalizeSubpath(raw);
  return normalized || undefined;
}

export function normalizeSubpath(input: unknown): string | null {
  const value = asOptionalString(input);
  if (!value) {
    return null;
  }
  return value
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

export function asString(input: unknown): string {
  return typeof input === 'string' ? input : input instanceof Date ? input.toISOString() : String(input || '');
}

export function asOptionalString(input: unknown): string | undefined {
  if (typeof input !== 'string') {
    return undefined;
  }
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function asIso(input: unknown): string {
  if (input instanceof Date) {
    return input.toISOString();
  }
  const asText = asOptionalString(input);
  return asText || new Date(0).toISOString();
}

export function toRecord(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }
  return input as Record<string, unknown>;
}

export function toStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
    .filter((item) => item.length > 0);
}

export function asOptionalNumber(input: unknown): number | undefined {
  const value = Number(input);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function countSignalHits(text: string, signals: string[]): number {
  let hits = 0;
  for (const signal of signals) {
    if (text.includes(signal)) {
      hits += 1;
    }
  }
  return hits;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function buildRoutingHint(args: {
  summaryRows: Array<Record<string, unknown>>;
  activeWorkRows: Array<Record<string, unknown>>;
  activityRows: Array<Record<string, unknown>>;
  currentSubpath?: string;
  projectName: string;
  projectKey: string;
}): string {
  const hints: string[] = [];
  hints.push(`${args.projectName} ${args.projectKey}`);
  if (args.currentSubpath) {
    hints.push(args.currentSubpath);
  }
  for (const row of args.summaryRows.slice(0, 2)) {
    hints.push(snippetFromMemory(row, 120));
  }
  for (const row of args.activeWorkRows.slice(0, 2)) {
    hints.push(snippetFromMemory(row, 80));
  }
  for (const row of args.activityRows.slice(0, 2)) {
    hints.push(snippetFromMemory(row, 80));
  }
  return hints
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .join(' ');
}
