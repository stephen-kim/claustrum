import { Prisma } from '@prisma/client';
import { ValidationError } from '../errors.js';

export type ThresholdCondition = {
  type: 'threshold';
  action_key: string;
  window_sec: number;
  count_gte: number;
  group_by: 'actor_user_id' | 'workspace';
};

export type NormalizedRule = {
  id: string;
  workspaceId: string;
  workspaceKey: string;
  name: string;
  severity: 'low' | 'medium' | 'high';
  condition: ThresholdCondition;
  notify: Record<string, unknown>;
};

export function safeNormalizeRule(row: {
  id: string;
  workspaceId: string;
  workspace: { key: string };
  name: string;
  severity: 'low' | 'medium' | 'high';
  condition: unknown;
  notify: unknown;
}): NormalizedRule | null {
  try {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      workspaceKey: row.workspace.key,
      name: row.name,
      severity: row.severity,
      condition: normalizeThresholdCondition(toObject(row.condition)),
      notify: normalizeNotify(toObject(row.notify)),
    };
  } catch {
    return null;
  }
}

export function normalizeThresholdCondition(input: Record<string, unknown>): ThresholdCondition {
  const type = String(input.type || '').trim();
  if (type !== 'threshold') {
    throw new ValidationError('condition.type must be "threshold".');
  }
  const actionKey = String(input.action_key || '').trim();
  if (!actionKey) {
    throw new ValidationError('condition.action_key is required.');
  }
  const windowSec = clampInt(input.window_sec, 300, 10, 24 * 60 * 60);
  const countGte = clampInt(input.count_gte, 20, 1, 1000000);
  const rawGroupBy = String(input.group_by || 'actor_user_id').trim();
  const groupBy: 'actor_user_id' | 'workspace' =
    rawGroupBy === 'workspace' ? 'workspace' : 'actor_user_id';
  return {
    type: 'threshold',
    action_key: actionKey,
    window_sec: windowSec,
    count_gte: countGte,
    group_by: groupBy,
  };
}

export function normalizeNotify(input: Record<string, unknown> | undefined): Record<string, unknown> {
  const via = String(input?.via || 'security_stream').trim() || 'security_stream';
  const sinkId = typeof input?.sink_id === 'string' && input.sink_id.trim() ? input.sink_id.trim() : undefined;
  const messageTemplate =
    typeof input?.message_template === 'string' && input.message_template.trim()
      ? input.message_template.trim()
      : undefined;
  return {
    via,
    ...(sinkId ? { sink_id: sinkId } : {}),
    ...(messageTemplate ? { message_template: messageTemplate } : {}),
  };
}

export function buildDetectionCorrelationId(args: {
  ruleId: string;
  groupKey: string;
  windowSec: number;
  now: Date;
}): string {
  const bucket = Math.floor(args.now.getTime() / (args.windowSec * 1000));
  return `det:${args.ruleId}:${args.groupKey}:${bucket}`;
}

export function toPrismaJson(input: Record<string, unknown>): Prisma.InputJsonValue {
  return input as Prisma.InputJsonValue;
}

export function toObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function clampInt(input: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(input);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}
