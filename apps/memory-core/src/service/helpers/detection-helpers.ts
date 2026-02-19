import type { PrismaClient } from '@prisma/client';
import type { AuthContext } from '../../auth.js';
import { assertWorkspaceAdmin } from '../access-control.js';
import { ValidationError } from '../errors.js';
import { diffFields, normalizeReason } from '../audit-utils.js';
import {
  buildDetectionCorrelationId,
  normalizeNotify,
  normalizeThresholdCondition,
  safeNormalizeRule,
  toObject,
  toPrismaJson,
  type NormalizedRule,
  type ThresholdCondition,
} from './detection-utils.js';

type Workspace = { id: string; key: string };

type DetectionDeps = {
  prisma: PrismaClient;
  getWorkspaceByKey: (workspaceKey: string) => Promise<Workspace>;
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

type DetectionRuleResponse = {
  id: string;
  name: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high';
  condition: Record<string, unknown>;
  notify: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function listDetectionRulesHandler(
  deps: DetectionDeps,
  args: { auth: AuthContext; workspaceKey: string }
): Promise<{ workspace_key: string; rules: DetectionRuleResponse[] }> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);

  const rows = await deps.prisma.detectionRule.findMany({
    where: { workspaceId: workspace.id },
    orderBy: [{ updatedAt: 'desc' }],
  });

  return {
    workspace_key: workspace.key,
    rules: rows.map((row) => ({
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      severity: row.severity,
      condition: toObject(row.condition),
      notify: toObject(row.notify),
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    })),
  };
}

export async function createDetectionRuleHandler(
  deps: DetectionDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    input: {
      name: string;
      enabled?: boolean;
      severity?: 'low' | 'medium' | 'high';
      condition: Record<string, unknown>;
      notify?: Record<string, unknown>;
      reason?: string;
    };
  }
): Promise<{ workspace_key: string; rule: DetectionRuleResponse }> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);

  const name = String(args.input.name || '').trim();
  if (!name) {
    throw new ValidationError('name is required.');
  }
  const condition = normalizeThresholdCondition(args.input.condition);
  const notify = normalizeNotify(args.input.notify);

  const created = await deps.prisma.detectionRule.create({
    data: {
      workspaceId: workspace.id,
      name,
      enabled: args.input.enabled ?? true,
      severity: args.input.severity || 'medium',
      condition: toPrismaJson(condition),
      notify: toPrismaJson(notify),
    },
  });

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'detection.rule.created',
    target: {
      workspace_key: workspace.key,
      rule_id: created.id,
      name: created.name,
      severity: created.severity,
      enabled: created.enabled,
      condition,
      notify,
      reason: normalizeReason(args.input.reason),
    },
  });

  return {
    workspace_key: workspace.key,
    rule: {
      id: created.id,
      name: created.name,
      enabled: created.enabled,
      severity: created.severity,
      condition: toObject(created.condition),
      notify: toObject(created.notify),
      created_at: created.createdAt.toISOString(),
      updated_at: created.updatedAt.toISOString(),
    },
  };
}

export async function updateDetectionRuleHandler(
  deps: DetectionDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    ruleId: string;
    input: {
      name?: string;
      enabled?: boolean;
      severity?: 'low' | 'medium' | 'high';
      condition?: Record<string, unknown>;
      notify?: Record<string, unknown>;
      reason?: string;
    };
  }
): Promise<{ workspace_key: string; rule: DetectionRuleResponse }> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);

  const existing = await deps.prisma.detectionRule.findFirst({
    where: {
      id: args.ruleId,
      workspaceId: workspace.id,
    },
  });
  if (!existing) {
    throw new ValidationError('Detection rule not found.');
  }

  const nextName =
    args.input.name !== undefined ? String(args.input.name || '').trim() : existing.name;
  if (!nextName) {
    throw new ValidationError('name cannot be empty.');
  }
  const nextCondition =
    args.input.condition !== undefined
      ? normalizeThresholdCondition(args.input.condition)
      : normalizeThresholdCondition(toObject(existing.condition));
  const nextNotify =
    args.input.notify !== undefined
      ? normalizeNotify(args.input.notify)
      : normalizeNotify(toObject(existing.notify));

  const updated = await deps.prisma.detectionRule.update({
    where: { id: existing.id },
    data: {
      name: nextName,
      enabled: args.input.enabled ?? existing.enabled,
      severity: args.input.severity ?? existing.severity,
      condition: toPrismaJson(nextCondition),
      notify: toPrismaJson(nextNotify),
    },
  });

  const before = {
    name: existing.name,
    enabled: existing.enabled,
    severity: existing.severity,
    condition: toObject(existing.condition),
    notify: toObject(existing.notify),
  };
  const after = {
    name: updated.name,
    enabled: updated.enabled,
    severity: updated.severity,
    condition: toObject(updated.condition),
    notify: toObject(updated.notify),
  };

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'detection.rule.updated',
    target: {
      workspace_key: workspace.key,
      rule_id: existing.id,
      changed_fields: diffFields(before, after),
      reason: normalizeReason(args.input.reason),
      before,
      after,
    },
  });

  return {
    workspace_key: workspace.key,
    rule: {
      id: updated.id,
      name: updated.name,
      enabled: updated.enabled,
      severity: updated.severity,
      condition: toObject(updated.condition),
      notify: toObject(updated.notify),
      created_at: updated.createdAt.toISOString(),
      updated_at: updated.updatedAt.toISOString(),
    },
  };
}

export async function deleteDetectionRuleHandler(
  deps: DetectionDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    ruleId: string;
    reason?: string;
  }
): Promise<{ deleted: true; rule_id: string }> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);

  const existing = await deps.prisma.detectionRule.findFirst({
    where: {
      id: args.ruleId,
      workspaceId: workspace.id,
    },
  });
  if (!existing) {
    throw new ValidationError('Detection rule not found.');
  }

  await deps.prisma.detectionRule.delete({
    where: { id: existing.id },
  });

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'detection.rule.deleted',
    target: {
      workspace_key: workspace.key,
      rule_id: existing.id,
      name: existing.name,
      reason: normalizeReason(args.reason),
    },
  });

  return {
    deleted: true,
    rule_id: existing.id,
  };
}

export async function listDetectionsHandler(
  deps: DetectionDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    status?: 'open' | 'ack' | 'closed';
    limit?: number;
  }
): Promise<{
  workspace_key: string;
  detections: Array<{
    id: string;
    rule_id: string;
    rule_name: string;
    severity: 'low' | 'medium' | 'high';
    status: 'open' | 'ack' | 'closed';
    actor_user_id: string | null;
    correlation_id: string | null;
    evidence: Record<string, unknown>;
    triggered_at: string;
    created_at: string;
    updated_at: string;
  }>;
}> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);

  const limit = Math.min(Math.max(args.limit || 100, 1), 500);
  const rows = await deps.prisma.detection.findMany({
    where: {
      workspaceId: workspace.id,
      status: args.status,
    },
    include: {
      rule: {
        select: {
          name: true,
          severity: true,
        },
      },
    },
    orderBy: [{ triggeredAt: 'desc' }],
    take: limit,
  });

  return {
    workspace_key: workspace.key,
    detections: rows.map((row) => ({
      id: row.id,
      rule_id: row.ruleId,
      rule_name: row.rule.name,
      severity: row.rule.severity,
      status: row.status,
      actor_user_id: row.actorUserId,
      correlation_id: row.correlationId,
      evidence: toObject(row.evidence),
      triggered_at: row.triggeredAt.toISOString(),
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    })),
  };
}

export async function updateDetectionStatusHandler(
  deps: DetectionDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    detectionId: string;
    status: 'open' | 'ack' | 'closed';
    reason?: string;
  }
): Promise<{ detection_id: string; status: 'open' | 'ack' | 'closed' }> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);

  const row = await deps.prisma.detection.findFirst({
    where: {
      id: args.detectionId,
      workspaceId: workspace.id,
    },
  });
  if (!row) {
    throw new ValidationError('Detection not found.');
  }

  await deps.prisma.detection.update({
    where: { id: row.id },
    data: { status: args.status },
  });

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'detection.status.updated',
    target: {
      workspace_key: workspace.key,
      detection_id: row.id,
      old_status: row.status,
      new_status: args.status,
      reason: normalizeReason(args.reason),
    },
  });

  return {
    detection_id: row.id,
    status: args.status,
  };
}

export async function runDetectionSweepHandler(
  deps: DetectionDeps,
  args?: { now?: Date; batchSize?: number }
): Promise<{ workspaces_processed: number; rules_processed: number; detections_created: number }> {
  const now = args?.now || new Date();
  const rules = await deps.prisma.detectionRule.findMany({
    where: { enabled: true },
    include: {
      workspace: {
        select: {
          id: true,
          key: true,
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: Math.min(Math.max(args?.batchSize || 200, 1), 2000),
  });

  let detectionsCreated = 0;
  let rulesProcessed = 0;
  const workspaceIds = new Set<string>();

  for (const rule of rules) {
    const normalized = safeNormalizeRule(rule);
    if (!normalized) {
      continue;
    }
    rulesProcessed += 1;
    workspaceIds.add(normalized.workspaceId);
    const created = await evaluateRule(deps, normalized, now);
    detectionsCreated += created;
  }

  return {
    workspaces_processed: workspaceIds.size,
    rules_processed: rulesProcessed,
    detections_created: detectionsCreated,
  };
}

async function evaluateRule(
  deps: DetectionDeps,
  rule: NormalizedRule,
  now: Date
): Promise<number> {
  const condition = rule.condition;
  const windowStart = new Date(now.getTime() - condition.window_sec * 1000);
  let created = 0;

  if (condition.group_by === 'actor_user_id') {
    const grouped = await deps.prisma.auditLog.groupBy({
      by: ['actorUserId'],
      where: {
        workspaceId: rule.workspaceId,
        action: condition.action_key,
        createdAt: { gte: windowStart },
      },
      _count: {
        _all: true,
      },
    });
    for (const group of grouped) {
      const count = group._count._all;
      if (count < condition.count_gte) {
        continue;
      }
      const actorUserId = group.actorUserId || null;
      const correlationId = buildDetectionCorrelationId({
        ruleId: rule.id,
        groupKey: actorUserId || 'none',
        windowSec: condition.window_sec,
        now,
      });
      const createdOne = await createDetectionIfMissing(deps, {
        rule,
        actorUserId,
        correlationId,
        evidence: {
          type: 'threshold',
          action_key: condition.action_key,
          window_sec: condition.window_sec,
          count: count,
          count_gte: condition.count_gte,
          group_by: 'actor_user_id',
          group_value: actorUserId,
          from: windowStart.toISOString(),
          to: now.toISOString(),
        },
      });
      created += createdOne;
    }
    return created;
  }

  const count = await deps.prisma.auditLog.count({
    where: {
      workspaceId: rule.workspaceId,
      action: condition.action_key,
      createdAt: { gte: windowStart },
    },
  });
  if (count < condition.count_gte) {
    return 0;
  }

  const correlationId = buildDetectionCorrelationId({
    ruleId: rule.id,
    groupKey: 'workspace',
    windowSec: condition.window_sec,
    now,
  });
  return createDetectionIfMissing(deps, {
    rule,
    actorUserId: null,
    correlationId,
    evidence: {
      type: 'threshold',
      action_key: condition.action_key,
      window_sec: condition.window_sec,
      count: count,
      count_gte: condition.count_gte,
      group_by: 'workspace',
      from: windowStart.toISOString(),
      to: now.toISOString(),
    },
  });
}

async function createDetectionIfMissing(
  deps: DetectionDeps,
  args: {
    rule: NormalizedRule;
    actorUserId: string | null;
    correlationId: string;
    evidence: Record<string, unknown>;
  }
): Promise<number> {
  const exists = await deps.prisma.detection.findFirst({
    where: {
      ruleId: args.rule.id,
      correlationId: args.correlationId,
    },
    select: {
      id: true,
    },
  });
  if (exists) {
    return 0;
  }

  const created = await deps.prisma.detection.create({
    data: {
      workspaceId: args.rule.workspaceId,
      ruleId: args.rule.id,
      actorUserId: args.actorUserId,
      correlationId: args.correlationId,
      evidence: toPrismaJson(args.evidence),
      status: 'open',
    },
  });

  await deps.recordAudit({
    workspaceId: args.rule.workspaceId,
    workspaceKey: args.rule.workspaceKey,
    actorUserId: 'system:detection-engine',
    actorUserEmail: 'detection-engine@local',
    action: 'security.detection.triggered',
    correlationId: args.correlationId,
    target: {
      source: 'system',
      category: 'access',
      severity: args.rule.severity,
      workspace_key: args.rule.workspaceKey,
      rule_id: args.rule.id,
      rule_name: args.rule.name,
      detection_id: created.id,
      actor_user_id: args.actorUserId,
      notify: args.rule.notify,
      evidence: args.evidence,
      correlation_id: args.correlationId,
    },
  });

  return 1;
}
