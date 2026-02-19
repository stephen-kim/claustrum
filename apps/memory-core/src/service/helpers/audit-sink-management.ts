import crypto from 'node:crypto';
import type { AuthContext } from '../../auth.js';
import { assertWorkspaceAdmin } from '../access-control.js';
import { ValidationError } from '../errors.js';
import { diffFields, normalizeReason } from '../audit-utils.js';
import {
  normalizeAuditSinkUrl,
  normalizeEventFilter,
  normalizeRetryPolicy,
  postSignedDelivery,
  toAuditSinkResponse,
  toPrismaJson,
} from './audit-sink-core.js';
import type { AuditSinkDeps, AuditSinkListItem } from './audit-sink-types.js';

export async function listAuditSinksHandler(
  deps: AuditSinkDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
  }
): Promise<{
  workspace_key: string;
  sinks: AuditSinkListItem[];
}> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);

  const rows = await deps.prisma.auditSink.findMany({
    where: { workspaceId: workspace.id },
    orderBy: [{ updatedAt: 'desc' }],
  });

  return {
    workspace_key: workspace.key,
    sinks: rows.map(toAuditSinkResponse),
  };
}

export async function createAuditSinkHandler(
  deps: AuditSinkDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    type: 'webhook' | 'http';
    name: string;
    enabled?: boolean;
    endpointUrl: string;
    secret: string;
    eventFilter?: Record<string, unknown>;
    retryPolicy?: Record<string, unknown>;
    reason?: string;
  }
): Promise<{
  workspace_key: string;
  sink: AuditSinkListItem;
}> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);

  const name = String(args.name || '').trim();
  if (!name) {
    throw new ValidationError('name is required.');
  }
  const endpointUrl = normalizeAuditSinkUrl(args.endpointUrl);
  const secret = String(args.secret || '').trim();
  if (!secret) {
    throw new ValidationError('secret is required.');
  }
  const eventFilter = normalizeEventFilter(args.eventFilter);
  const retryPolicy = normalizeRetryPolicy(args.retryPolicy);

  const created = await deps.prisma.auditSink.create({
    data: {
      workspaceId: workspace.id,
      type: args.type,
      name,
      enabled: args.enabled ?? true,
      endpointUrl,
      secret,
      eventFilter: toPrismaJson({
        include_prefixes: eventFilter.includePrefixes,
        exclude_actions: eventFilter.excludeActions,
      }),
      retryPolicy: toPrismaJson({
        max_attempts: retryPolicy.maxAttempts,
        backoff_sec: retryPolicy.backoffSec,
      }),
    },
  });

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'audit.sink.created',
    target: {
      workspace_key: workspace.key,
      sink_id: created.id,
      sink_name: created.name,
      sink_type: created.type,
      endpoint_url: created.endpointUrl,
      enabled: created.enabled,
      reason: normalizeReason(args.reason),
      event_filter: {
        include_prefixes: eventFilter.includePrefixes,
        exclude_actions: eventFilter.excludeActions,
      },
      retry_policy: {
        max_attempts: retryPolicy.maxAttempts,
        backoff_sec: retryPolicy.backoffSec,
      },
    },
  });

  return {
    workspace_key: workspace.key,
    sink: toAuditSinkResponse(created),
  };
}

export async function updateAuditSinkHandler(
  deps: AuditSinkDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    sinkId: string;
    input: {
      name?: string;
      enabled?: boolean;
      endpoint_url?: string;
      secret?: string;
      event_filter?: Record<string, unknown>;
      retry_policy?: Record<string, unknown>;
      reason?: string;
    };
  }
): Promise<{
  workspace_key: string;
  sink: AuditSinkListItem;
}> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);

  const existing = await deps.prisma.auditSink.findFirst({
    where: {
      id: args.sinkId,
      workspaceId: workspace.id,
    },
  });
  if (!existing) {
    throw new ValidationError('Audit sink not found.');
  }

  const nextName = args.input.name !== undefined ? String(args.input.name || '').trim() : existing.name;
  if (!nextName) {
    throw new ValidationError('name cannot be empty.');
  }
  const nextEndpoint =
    args.input.endpoint_url !== undefined
      ? normalizeAuditSinkUrl(args.input.endpoint_url)
      : existing.endpointUrl;
  const nextSecret =
    args.input.secret !== undefined ? String(args.input.secret || '').trim() : existing.secret;
  if (!nextSecret) {
    throw new ValidationError('secret cannot be empty.');
  }

  const currentFilter = normalizeEventFilter(existing.eventFilter as Record<string, unknown>);
  const nextFilter =
    args.input.event_filter !== undefined
      ? normalizeEventFilter(args.input.event_filter)
      : currentFilter;
  const currentRetry = normalizeRetryPolicy(existing.retryPolicy as Record<string, unknown>);
  const nextRetry =
    args.input.retry_policy !== undefined
      ? normalizeRetryPolicy(args.input.retry_policy)
      : currentRetry;

  const updated = await deps.prisma.auditSink.update({
    where: { id: existing.id },
    data: {
      name: nextName,
      enabled: args.input.enabled ?? existing.enabled,
      endpointUrl: nextEndpoint,
      secret: nextSecret,
      eventFilter: toPrismaJson({
        include_prefixes: nextFilter.includePrefixes,
        exclude_actions: nextFilter.excludeActions,
      }),
      retryPolicy: toPrismaJson({
        max_attempts: nextRetry.maxAttempts,
        backoff_sec: nextRetry.backoffSec,
      }),
    },
  });

  const before = {
    name: existing.name,
    enabled: existing.enabled,
    endpoint_url: existing.endpointUrl,
    has_secret: Boolean(existing.secret),
    event_filter: {
      include_prefixes: currentFilter.includePrefixes,
      exclude_actions: currentFilter.excludeActions,
    },
    retry_policy: {
      max_attempts: currentRetry.maxAttempts,
      backoff_sec: currentRetry.backoffSec,
    },
  };
  const after = {
    name: updated.name,
    enabled: updated.enabled,
    endpoint_url: updated.endpointUrl,
    has_secret: Boolean(updated.secret),
    event_filter: {
      include_prefixes: nextFilter.includePrefixes,
      exclude_actions: nextFilter.excludeActions,
    },
    retry_policy: {
      max_attempts: nextRetry.maxAttempts,
      backoff_sec: nextRetry.backoffSec,
    },
  };

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'audit.sink.updated',
    target: {
      workspace_key: workspace.key,
      sink_id: existing.id,
      changed_fields: diffFields(before, after),
      reason: normalizeReason(args.input.reason),
      before,
      after,
    },
  });

  return {
    workspace_key: workspace.key,
    sink: toAuditSinkResponse(updated),
  };
}

export async function deleteAuditSinkHandler(
  deps: AuditSinkDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    sinkId: string;
    reason?: string;
  }
): Promise<{ deleted: true; sink_id: string }> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);

  const existing = await deps.prisma.auditSink.findFirst({
    where: {
      id: args.sinkId,
      workspaceId: workspace.id,
    },
  });
  if (!existing) {
    throw new ValidationError('Audit sink not found.');
  }

  await deps.prisma.$transaction(async (tx) => {
    await tx.workspaceSettings.updateMany({
      where: {
        workspaceId: workspace.id,
        securityStreamSinkId: existing.id,
      },
      data: {
        securityStreamSinkId: null,
      },
    });
    await tx.auditSink.delete({
      where: { id: existing.id },
    });
  });

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'audit.sink.deleted',
    target: {
      workspace_key: workspace.key,
      sink_id: existing.id,
      sink_name: existing.name,
      reason: normalizeReason(args.reason),
    },
  });

  return {
    deleted: true,
    sink_id: existing.id,
  };
}

export async function testAuditSinkDeliveryHandler(
  deps: AuditSinkDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    sinkId: string;
  }
): Promise<{ ok: true; sink_id: string; status: number }> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);

  const sink = await deps.prisma.auditSink.findFirst({
    where: {
      id: args.sinkId,
      workspaceId: workspace.id,
    },
  });
  if (!sink) {
    throw new ValidationError('Audit sink not found.');
  }

  const now = new Date();
  const payload = {
    delivery_id: `test-${crypto.randomUUID()}`,
    workspace_key: workspace.key,
    action_key: 'audit.sink.test',
    created_at: now.toISOString(),
    actor_user_id: args.auth.user.id,
    correlation_id: null,
    params: {
      source: 'manual',
      message: 'Claustrum audit sink connectivity test',
    },
  };

  const response = await postSignedDelivery({
    endpointUrl: sink.endpointUrl,
    secret: sink.secret,
    workspaceKey: workspace.key,
    actionKey: 'audit.sink.test',
    deliveryId: payload.delivery_id,
    body: payload,
  });

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'audit.sink.test_delivery',
    target: {
      workspace_key: workspace.key,
      sink_id: sink.id,
      sink_name: sink.name,
      status_code: response.status,
    },
  });

  return {
    ok: true,
    sink_id: sink.id,
    status: response.status,
  };
}

export async function listAuditDeliveryQueueHandler(
  deps: AuditSinkDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    sinkId?: string;
    status?: 'queued' | 'sending' | 'delivered' | 'failed';
    limit?: number;
  }
): Promise<{
  workspace_key: string;
  deliveries: Array<{
    id: string;
    sink_id: string;
    sink_name: string;
    audit_log_id: string;
    action_key: string;
    status: 'queued' | 'sending' | 'delivered' | 'failed';
    attempt_count: number;
    next_attempt_at: string;
    last_error: string | null;
    created_at: string;
    updated_at: string;
  }>;
}> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);
  const limit = Math.min(Math.max(args.limit || 100, 1), 500);

  const rows = await deps.prisma.auditDeliveryQueue.findMany({
    where: {
      workspaceId: workspace.id,
      sinkId: args.sinkId || undefined,
      status: args.status,
    },
    include: {
      sink: {
        select: {
          name: true,
        },
      },
      auditLog: {
        select: {
          action: true,
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: limit,
  });

  return {
    workspace_key: workspace.key,
    deliveries: rows.map((row) => ({
      id: row.id,
      sink_id: row.sinkId,
      sink_name: row.sink.name,
      audit_log_id: row.auditLogId,
      action_key: row.auditLog.action,
      status: row.status,
      attempt_count: row.attemptCount,
      next_attempt_at: row.nextAttemptAt.toISOString(),
      last_error: row.lastError || null,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    })),
  };
}
