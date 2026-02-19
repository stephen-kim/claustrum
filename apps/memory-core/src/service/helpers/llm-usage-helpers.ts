import { Prisma, type PrismaClient } from '@prisma/client';
import type { AuthContext } from '../../auth.js';
import { assertWorkspaceAccess } from '../access-control.js';
import { ValidationError } from '../errors.js';

export type LlmUsagePurpose = 'decision_extract' | 'summarize' | 'routing' | 'eval_judge' | string;
export type LlmUsageGroupBy = 'day' | 'purpose' | 'model';

export type RecordLlmUsageArgs = {
  workspaceId: string;
  projectId?: string | null;
  actorUserId?: string | null;
  systemActor?: string | null;
  purpose: LlmUsagePurpose;
  provider: string;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  correlationId?: string | null;
};

type PricingCacheEntry = {
  inputTokenPricePer1kCents: number;
  outputTokenPricePer1kCents: number;
};

const PRICING_CACHE_TTL_MS = 60 * 1000;
const pricingCache = new Map<string, { entry: PricingCacheEntry | null; expiresAtUnixMs: number }>();

function toSafeTokenCount(value: number | null | undefined): number | null {
  if (!Number.isFinite(value as number)) {
    return null;
  }
  const rounded = Math.round(Number(value));
  if (rounded < 0) {
    return 0;
  }
  return rounded;
}

function buildPricingCacheKey(provider: string, model: string): string {
  return `${provider.trim().toLowerCase()}::${model.trim()}`;
}

async function getPricing(args: {
  prisma: PrismaClient;
  provider: string;
  model: string;
}): Promise<{ inputTokenPricePer1kCents: number; outputTokenPricePer1kCents: number } | null> {
  const key = buildPricingCacheKey(args.provider, args.model);
  const now = Date.now();
  const cached = pricingCache.get(key);
  if (cached && cached.expiresAtUnixMs > now) {
    return cached.entry;
  }

  const pricing = await args.prisma.llmPricing.findFirst({
    where: {
      provider: args.provider,
      model: args.model,
      isActive: true,
    },
    select: {
      inputTokenPricePer1kCents: true,
      outputTokenPricePer1kCents: true,
    },
    orderBy: [{ updatedAt: 'desc' }],
  });

  if (!pricing) {
    pricingCache.set(key, {
      entry: null,
      expiresAtUnixMs: now + PRICING_CACHE_TTL_MS,
    });
    return null;
  }

  const entry: PricingCacheEntry = {
    inputTokenPricePer1kCents: pricing.inputTokenPricePer1kCents,
    outputTokenPricePer1kCents: pricing.outputTokenPricePer1kCents,
  };
  pricingCache.set(key, {
    entry,
    expiresAtUnixMs: now + PRICING_CACHE_TTL_MS,
  });
  return entry;
}

function estimateCostCents(args: {
  inputTokens: number | null;
  outputTokens: number | null;
  pricing: { inputTokenPricePer1kCents: number; outputTokenPricePer1kCents: number } | null;
}): number | null {
  if (!args.pricing) {
    return null;
  }
  const inputTokens = args.inputTokens ?? 0;
  const outputTokens = args.outputTokens ?? 0;
  if (inputTokens <= 0 && outputTokens <= 0) {
    return 0;
  }
  const inputCost = (inputTokens / 1000) * args.pricing.inputTokenPricePer1kCents;
  const outputCost = (outputTokens / 1000) * args.pricing.outputTokenPricePer1kCents;
  return Number((inputCost + outputCost).toFixed(6));
}

export async function recordLlmUsageEvent(args: {
  prisma: PrismaClient;
  usage: RecordLlmUsageArgs;
}): Promise<void> {
  const provider = String(args.usage.provider || '').trim().toLowerCase();
  const model = String(args.usage.model || '').trim();
  const purpose = String(args.usage.purpose || '').trim();
  if (!provider || !model || !purpose) {
    return;
  }

  const inputTokens = toSafeTokenCount(args.usage.inputTokens);
  const outputTokens = toSafeTokenCount(args.usage.outputTokens);
  const pricing = await getPricing({
    prisma: args.prisma,
    provider,
    model,
  });
  const estimatedCostCents = estimateCostCents({
    inputTokens,
    outputTokens,
    pricing,
  });

  await args.prisma.llmUsageEvent.create({
    data: {
      workspaceId: args.usage.workspaceId,
      projectId: args.usage.projectId || null,
      actorUserId: args.usage.actorUserId || null,
      systemActor: args.usage.systemActor || null,
      purpose,
      provider,
      model,
      inputTokens,
      outputTokens,
      estimatedCostCents,
      correlationId: args.usage.correlationId || null,
    },
  });
}

function parseOptionalDate(name: string, raw?: string): Date | undefined {
  if (!raw) {
    return undefined;
  }
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    throw new ValidationError(`${name} must be a valid ISO datetime.`);
  }
  return parsed;
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return numeric;
}

export async function listLlmUsageHandler(args: {
  prisma: PrismaClient;
  auth: AuthContext;
  getWorkspaceByKey: (workspaceKey: string) => Promise<{ id: string; key: string }>;
  workspaceKey: string;
  from?: string;
  to?: string;
  groupBy: LlmUsageGroupBy;
}): Promise<{
  workspace_key: string;
  from?: string;
  to?: string;
  group_by: LlmUsageGroupBy;
  totals: {
    event_count: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_cents: number;
  };
  items: Array<{
    group_key: string;
    purpose?: string;
    provider?: string;
    model?: string;
    event_count: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_cents: number;
  }>;
}> {
  const workspace = await args.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAccess(args.prisma, args.auth, workspace.id, 'MEMBER');

  const fromDate = parseOptionalDate('from', args.from);
  const toDate = parseOptionalDate('to', args.to);
  if (fromDate && toDate && fromDate > toDate) {
    throw new ValidationError('from must be earlier than to.');
  }

  const clauses = [Prisma.sql`"workspace_id" = ${workspace.id}`];
  if (fromDate) {
    clauses.push(Prisma.sql`"created_at" >= ${fromDate}`);
  }
  if (toDate) {
    clauses.push(Prisma.sql`"created_at" <= ${toDate}`);
  }
  const whereSql = Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;

  const totalsRows = await args.prisma.$queryRaw<Array<{
    event_count: bigint | number | string;
    input_tokens: number | string | null;
    output_tokens: number | string | null;
    estimated_cost_cents: number | string | null;
  }>>(
    Prisma.sql`
      SELECT
        COUNT(*) AS event_count,
        COALESCE(SUM(COALESCE("input_tokens", 0)), 0) AS input_tokens,
        COALESCE(SUM(COALESCE("output_tokens", 0)), 0) AS output_tokens,
        COALESCE(SUM(COALESCE("estimated_cost_cents", 0)), 0) AS estimated_cost_cents
      FROM "llm_usage_events"
      ${whereSql}
    `
  );

  const totalsRow = totalsRows[0];
  const totals = {
    event_count: toNumber(totalsRow?.event_count),
    input_tokens: toNumber(totalsRow?.input_tokens),
    output_tokens: toNumber(totalsRow?.output_tokens),
    estimated_cost_cents: Number(toNumber(totalsRow?.estimated_cost_cents).toFixed(6)),
  };

  let items: Array<{
    group_key: string;
    purpose?: string;
    provider?: string;
    model?: string;
    event_count: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_cents: number;
  }> = [];

  if (args.groupBy === 'day') {
    const rows = await args.prisma.$queryRaw<Array<{
      group_key: string;
      event_count: bigint | number | string;
      input_tokens: number | string | null;
      output_tokens: number | string | null;
      estimated_cost_cents: number | string | null;
    }>>(
      Prisma.sql`
        SELECT
          to_char(date_trunc('day', "created_at"), 'YYYY-MM-DD') AS group_key,
          COUNT(*) AS event_count,
          COALESCE(SUM(COALESCE("input_tokens", 0)), 0) AS input_tokens,
          COALESCE(SUM(COALESCE("output_tokens", 0)), 0) AS output_tokens,
          COALESCE(SUM(COALESCE("estimated_cost_cents", 0)), 0) AS estimated_cost_cents
        FROM "llm_usage_events"
        ${whereSql}
        GROUP BY 1
        ORDER BY 1 DESC
      `
    );
    items = rows.map((row) => ({
      group_key: row.group_key,
      event_count: toNumber(row.event_count),
      input_tokens: toNumber(row.input_tokens),
      output_tokens: toNumber(row.output_tokens),
      estimated_cost_cents: Number(toNumber(row.estimated_cost_cents).toFixed(6)),
    }));
  } else if (args.groupBy === 'purpose') {
    const rows = await args.prisma.$queryRaw<Array<{
      group_key: string;
      purpose: string;
      event_count: bigint | number | string;
      input_tokens: number | string | null;
      output_tokens: number | string | null;
      estimated_cost_cents: number | string | null;
    }>>(
      Prisma.sql`
        SELECT
          COALESCE(NULLIF("purpose", ''), 'unknown') AS group_key,
          COALESCE(NULLIF("purpose", ''), 'unknown') AS purpose,
          COUNT(*) AS event_count,
          COALESCE(SUM(COALESCE("input_tokens", 0)), 0) AS input_tokens,
          COALESCE(SUM(COALESCE("output_tokens", 0)), 0) AS output_tokens,
          COALESCE(SUM(COALESCE("estimated_cost_cents", 0)), 0) AS estimated_cost_cents
        FROM "llm_usage_events"
        ${whereSql}
        GROUP BY 1, 2
        ORDER BY 1 ASC
      `
    );
    items = rows.map((row) => ({
      group_key: row.group_key,
      purpose: row.purpose,
      event_count: toNumber(row.event_count),
      input_tokens: toNumber(row.input_tokens),
      output_tokens: toNumber(row.output_tokens),
      estimated_cost_cents: Number(toNumber(row.estimated_cost_cents).toFixed(6)),
    }));
  } else {
    const rows = await args.prisma.$queryRaw<Array<{
      provider: string;
      model: string;
      group_key: string;
      event_count: bigint | number | string;
      input_tokens: number | string | null;
      output_tokens: number | string | null;
      estimated_cost_cents: number | string | null;
    }>>(
      Prisma.sql`
        SELECT
          COALESCE(NULLIF("provider", ''), 'unknown') AS provider,
          COALESCE(NULLIF("model", ''), 'unknown') AS model,
          CONCAT(COALESCE(NULLIF("provider", ''), 'unknown'), ':', COALESCE(NULLIF("model", ''), 'unknown')) AS group_key,
          COUNT(*) AS event_count,
          COALESCE(SUM(COALESCE("input_tokens", 0)), 0) AS input_tokens,
          COALESCE(SUM(COALESCE("output_tokens", 0)), 0) AS output_tokens,
          COALESCE(SUM(COALESCE("estimated_cost_cents", 0)), 0) AS estimated_cost_cents
        FROM "llm_usage_events"
        ${whereSql}
        GROUP BY 1, 2, 3
        ORDER BY 1 ASC, 2 ASC
      `
    );
    items = rows.map((row) => ({
      group_key: row.group_key,
      provider: row.provider,
      model: row.model,
      event_count: toNumber(row.event_count),
      input_tokens: toNumber(row.input_tokens),
      output_tokens: toNumber(row.output_tokens),
      estimated_cost_cents: Number(toNumber(row.estimated_cost_cents).toFixed(6)),
    }));
  }

  return {
    workspace_key: workspace.key,
    from: fromDate ? fromDate.toISOString() : undefined,
    to: toDate ? toDate.toISOString() : undefined,
    group_by: args.groupBy,
    totals,
    items,
  };
}
