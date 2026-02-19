import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuthContext } from '../../auth.js';
import { assertWorkspaceAccess, assertWorkspaceAdmin, isWorkspaceAdminRole } from '../access-control.js';
import { normalizeReason } from '../audit-utils.js';
import { ValidationError } from '../errors.js';
import {
  buildRulesSummaryText,
  type RuleCategory,
  type RuleScope,
  type RuleSeverity,
} from './global-rules-selection.js';

type WorkspaceRef = { id: string; key: string };

type GlobalRulesDeps = {
  prisma: PrismaClient;
  getWorkspaceByKey: (workspaceKey: string) => Promise<WorkspaceRef>;
  recordAudit: (args: {
    workspaceId: string;
    projectId?: string;
    workspaceKey?: string;
    actorUserId: string;
    actorUserEmail?: string;
    action: string;
    target: Record<string, unknown>;
    correlationId?: string;
  }) => Promise<void>;
};

export type GlobalRuleApiRecord = {
  id: string;
  scope: RuleScope;
  workspace_id?: string | null;
  user_id?: string | null;
  title: string;
  content: string;
  category: RuleCategory;
  priority: number;
  severity: RuleSeverity;
  pinned: boolean;
  enabled: boolean;
  tags: string[];
  usage_count: number;
  last_routed_at?: string;
  created_at: string;
  updated_at: string;
};

type GlobalRuleInput = {
  scope?: RuleScope;
  user_id?: string;
  title?: string;
  content?: string;
  category?: RuleCategory;
  priority?: number;
  severity?: RuleSeverity;
  pinned?: boolean;
  enabled?: boolean;
  tags?: string[];
  reason?: string;
};

export { buildGlobalRulesBundle } from './global-rules-bundle.js';
export {
  buildRulesSummaryText,
  selectRulesWithinBudget,
  type RoutingMode,
  type RoutingScoreBreakdown,
  type RuleSelectionResult,
  type SelectedRule,
  type SelectionMode,
} from './global-rules-selection.js';

function toJsonValue(input: unknown): Prisma.InputJsonValue {
  return input as Prisma.InputJsonValue;
}

function clampInt(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(Math.round(value), min), max);
}

function normalizeScope(input: unknown): RuleScope {
  if (input === 'workspace' || input === 'user') {
    return input;
  }
  return 'workspace';
}

function normalizeCategory(input: unknown): RuleCategory {
  if (
    input === 'policy' ||
    input === 'security' ||
    input === 'style' ||
    input === 'process' ||
    input === 'other'
  ) {
    return input;
  }
  return 'policy';
}

function normalizeSeverity(input: unknown): RuleSeverity {
  if (input === 'low' || input === 'high') {
    return input;
  }
  return 'medium';
}

function normalizeTitle(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input.trim().slice(0, 200);
}

function normalizeContent(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input.trim().slice(0, 10000);
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

function normalizeRuleInput(input: GlobalRuleInput, mode: 'create' | 'update') {
  const normalized = {
    scope: normalizeScope(input.scope),
    user_id: typeof input.user_id === 'string' ? input.user_id.trim() : '',
    title: normalizeTitle(input.title),
    content: normalizeContent(input.content),
    category: normalizeCategory(input.category),
    priority: clampInt(Number(input.priority ?? 3), 3, 1, 5),
    severity: normalizeSeverity(input.severity),
    pinned: input.pinned === true,
    enabled: input.enabled !== false,
    tags: normalizeTags(input.tags),
  };

  if (mode === 'create') {
    if (!normalized.title) {
      throw new ValidationError('title is required');
    }
    if (!normalized.content) {
      throw new ValidationError('content is required');
    }
  }

  return normalized;
}

async function assertScopeAccess(args: {
  prisma: PrismaClient;
  auth: AuthContext;
  workspaceId: string;
  scope: RuleScope;
  targetUserId?: string;
}): Promise<void> {
  const membership = await assertWorkspaceAccess(args.prisma, args.auth, args.workspaceId);
  if (args.scope === 'workspace') {
    if (!isWorkspaceAdminRole(membership.role)) {
      throw new ValidationError('Workspace-scope global rules require admin role.');
    }
    return;
  }

  const targetUserId = args.targetUserId || args.auth.user.id;
  if (targetUserId === args.auth.user.id) {
    return;
  }
  if (!isWorkspaceAdminRole(membership.role)) {
    throw new ValidationError('Only workspace admin can manage other user rules.');
  }

  const targetMembership = await args.prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: args.workspaceId,
        userId: targetUserId,
      },
    },
    select: { userId: true },
  });
  if (!targetMembership) {
    throw new ValidationError('target user is not a member of this workspace.');
  }
}

function toApiRecord(row: {
  id: string;
  scope: RuleScope;
  workspaceId: string | null;
  userId: string | null;
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
  createdAt: Date;
  updatedAt: Date;
}): GlobalRuleApiRecord {
  return {
    id: row.id,
    scope: row.scope,
    workspace_id: row.workspaceId,
    user_id: row.userId,
    title: row.title,
    content: row.content,
    category: row.category,
    priority: row.priority,
    severity: row.severity,
    pinned: row.pinned,
    enabled: row.enabled,
    tags: normalizeTags(row.tags),
    usage_count: row.usageCount,
    last_routed_at: row.lastRoutedAt ? row.lastRoutedAt.toISOString() : undefined,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listGlobalRulesHandler(
  deps: GlobalRulesDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    scope: RuleScope;
    userId?: string;
  }
): Promise<{ workspace_key: string; scope: RuleScope; rules: GlobalRuleApiRecord[] }> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  const targetUserId = args.userId || args.auth.user.id;

  await assertScopeAccess({
    prisma: deps.prisma,
    auth: args.auth,
    workspaceId: workspace.id,
    scope: args.scope,
    targetUserId,
  });

  const rows = await deps.prisma.globalRule.findMany({
    where:
      args.scope === 'workspace'
        ? {
            scope: 'workspace',
            workspaceId: workspace.id,
          }
        : {
            scope: 'user',
            workspaceId: workspace.id,
            userId: targetUserId,
          },
    orderBy: [{ pinned: 'desc' }, { severity: 'desc' }, { priority: 'asc' }, { updatedAt: 'desc' }],
  });

  return {
    workspace_key: workspace.key,
    scope: args.scope,
    rules: rows.map(toApiRecord),
  };
}

export async function createGlobalRuleHandler(
  deps: GlobalRulesDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    input: GlobalRuleInput;
  }
): Promise<GlobalRuleApiRecord> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  const payload = normalizeRuleInput(args.input, 'create');
  const targetUserId = payload.scope === 'user' ? payload.user_id || args.auth.user.id : undefined;

  await assertScopeAccess({
    prisma: deps.prisma,
    auth: args.auth,
    workspaceId: workspace.id,
    scope: payload.scope,
    targetUserId,
  });

  const created = await deps.prisma.globalRule.create({
    data: {
      scope: payload.scope,
      workspaceId: workspace.id,
      userId: payload.scope === 'user' ? targetUserId! : null,
      title: payload.title,
      content: payload.content,
      category: payload.category,
      priority: payload.priority,
      severity: payload.severity,
      pinned: payload.pinned,
      enabled: payload.enabled,
      tags: toJsonValue(payload.tags),
    },
  });

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'global_rules.create',
    target: {
      rule_id: created.id,
      scope: created.scope,
      user_id: created.userId,
      title: created.title,
      tags: normalizeTags(created.tags),
      reason: normalizeReason(args.input.reason),
    },
  });

  return toApiRecord(created);
}

export async function updateGlobalRuleHandler(
  deps: GlobalRulesDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    ruleId: string;
    input: GlobalRuleInput;
  }
): Promise<GlobalRuleApiRecord> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  const existing = await deps.prisma.globalRule.findUnique({ where: { id: args.ruleId } });
  if (!existing || existing.workspaceId !== workspace.id) {
    throw new ValidationError('global rule not found in workspace');
  }

  const payload = normalizeRuleInput(args.input, 'update');
  await assertScopeAccess({
    prisma: deps.prisma,
    auth: args.auth,
    workspaceId: workspace.id,
    scope: existing.scope,
    targetUserId: existing.userId || undefined,
  });

  const updated = await deps.prisma.globalRule.update({
    where: { id: existing.id },
    data: {
      title: payload.title || undefined,
      content: payload.content || undefined,
      category: args.input.category === undefined ? undefined : payload.category,
      priority: args.input.priority === undefined ? undefined : payload.priority,
      severity: args.input.severity === undefined ? undefined : payload.severity,
      pinned: typeof args.input.pinned === 'boolean' ? payload.pinned : undefined,
      enabled: typeof args.input.enabled === 'boolean' ? payload.enabled : undefined,
      tags: args.input.tags === undefined ? undefined : toJsonValue(payload.tags),
    },
  });

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'global_rules.update',
    target: {
      rule_id: updated.id,
      scope: updated.scope,
      user_id: updated.userId,
      title: updated.title,
      tags: normalizeTags(updated.tags),
      reason: normalizeReason(args.input.reason),
    },
  });

  return toApiRecord(updated);
}

export async function deleteGlobalRuleHandler(
  deps: GlobalRulesDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    ruleId: string;
    reason?: string;
  }
): Promise<{ deleted: true; id: string }> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  const existing = await deps.prisma.globalRule.findUnique({ where: { id: args.ruleId } });
  if (!existing || existing.workspaceId !== workspace.id) {
    throw new ValidationError('global rule not found in workspace');
  }

  await assertScopeAccess({
    prisma: deps.prisma,
    auth: args.auth,
    workspaceId: workspace.id,
    scope: existing.scope,
    targetUserId: existing.userId || undefined,
  });

  await deps.prisma.globalRule.delete({ where: { id: existing.id } });

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'global_rules.delete',
    target: {
      rule_id: existing.id,
      scope: existing.scope,
      user_id: existing.userId,
      title: existing.title,
      reason: normalizeReason(args.reason),
    },
  });

  return { deleted: true, id: existing.id };
}

export async function summarizeGlobalRulesHandler(
  deps: GlobalRulesDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    scope: RuleScope;
    userId?: string;
    mode: 'preview' | 'replace';
    reason?: string;
  }
): Promise<{
    workspace_key: string;
    scope: RuleScope;
    user_id?: string;
    mode: 'preview' | 'replace';
    summary: string;
    source_rule_ids: string[];
    updated_at?: string;
  }> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  const targetUserId = args.scope === 'user' ? args.userId || args.auth.user.id : undefined;

  await assertScopeAccess({
    prisma: deps.prisma,
    auth: args.auth,
    workspaceId: workspace.id,
    scope: args.scope,
    targetUserId,
  });

  const rules = await deps.prisma.globalRule.findMany({
    where:
      args.scope === 'workspace'
        ? { workspaceId: workspace.id, scope: 'workspace', enabled: true }
        : { workspaceId: workspace.id, scope: 'user', userId: targetUserId, enabled: true },
    orderBy: [{ pinned: 'desc' }, { severity: 'desc' }, { priority: 'asc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      content: true,
      category: true,
      severity: true,
      priority: true,
      pinned: true,
    },
  });

  const summary = buildRulesSummaryText({
    scope: args.scope,
    rules,
  });

  const sourceRuleIds = rules.map((rule) => rule.id);
  if (args.mode === 'preview') {
    return {
      workspace_key: workspace.key,
      scope: args.scope,
      user_id: targetUserId,
      mode: 'preview',
      summary,
      source_rule_ids: sourceRuleIds,
    };
  }

  const existingSummary = await deps.prisma.globalRuleSummary.findFirst({
    where: {
      scope: args.scope,
      workspaceId: workspace.id,
      userId: args.scope === 'user' ? targetUserId! : null,
    },
    select: { id: true },
  });
  const saved = existingSummary
    ? await deps.prisma.globalRuleSummary.update({
        where: { id: existingSummary.id },
        data: {
          summary,
          sourceRuleIds: toJsonValue(sourceRuleIds),
        },
      })
    : await deps.prisma.globalRuleSummary.create({
        data: {
          scope: args.scope,
          workspaceId: workspace.id,
          userId: targetUserId || null,
          summary,
          sourceRuleIds: toJsonValue(sourceRuleIds),
        },
      });

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'global_rules.summarized',
    target: {
      scope: args.scope,
      user_id: targetUserId,
      summary_id: saved.id,
      source_rule_count: sourceRuleIds.length,
      reason: normalizeReason(args.reason),
    },
  });

  return {
    workspace_key: workspace.key,
    scope: args.scope,
    user_id: targetUserId,
    mode: 'replace',
    summary,
    source_rule_ids: sourceRuleIds,
    updated_at: saved.updatedAt.toISOString(),
  };
}
