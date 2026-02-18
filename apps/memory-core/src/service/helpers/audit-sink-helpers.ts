import crypto from 'node:crypto';
import net from 'node:net';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { AuthContext } from '../../auth.js';
import { assertWorkspaceAdmin } from '../access-control.js';
import { ValidationError } from '../errors.js';
import { diffFields, normalizeReason } from '../audit-utils.js';
import { getEffectiveWorkspaceSettings } from '../workspace-resolution.js';
import {
  isSeverityAtLeast,
  resolveSecurityClassification,
} from './security-taxonomy-helpers.js';

type Workspace = { id: string; key: string };

type RetryPolicy = {
  maxAttempts: number;
  backoffSec: number[];
};

type EventFilter = {
  includePrefixes: string[];
  excludeActions: string[];
};

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  backoffSec: [1, 5, 30, 120, 600],
};

const SECURITY_PREFIXES = [
  'auth.',
  'access.',
  'api_key.',
  'oidc.',
  'github.permissions.',
  'security.',
  'raw.',
  'audit.',
] as const;

type AuditSinkDeps = {
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

export type AuditSinkListItem = {
  id: string;
  type: 'webhook' | 'http';
  name: string;
  enabled: boolean;
  endpoint_url: string;
  has_secret: boolean;
  event_filter: {
    include_prefixes: string[];
    exclude_actions: string[];
  };
  retry_policy: {
    max_attempts: number;
    backoff_sec: number[];
  };
  created_at: string;
  updated_at: string;
};

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

export async function enqueueAuditDeliveriesForLog(args: {
  prisma: PrismaClient;
  auditLogId: string;
  workspaceId: string;
  action: string;
  target: Record<string, unknown>;
}): Promise<void> {
  if (args.action.startsWith('audit.delivery.')) {
    return;
  }

  const [settings, sinks] = await Promise.all([
    getEffectiveWorkspaceSettings(args.prisma, args.workspaceId),
    args.prisma.auditSink.findMany({
      where: {
        workspaceId: args.workspaceId,
        enabled: true,
      },
      select: {
        id: true,
        eventFilter: true,
      },
    }),
  ]);

  if (sinks.length === 0) {
    return;
  }

  const classification = resolveSecurityClassification({
    action: args.action,
    target: args.target,
  });

  const selectedSinkIds = new Set<string>();
  for (const sink of sinks) {
    const filter = normalizeEventFilter(sink.eventFilter as Record<string, unknown>);
    if (shouldQueueByFilter(args.action, filter)) {
      selectedSinkIds.add(sink.id);
    }
  }

  if (
    settings.securityStreamEnabled &&
    classification.isSecurityEvent &&
    isSeverityAtLeast(classification.severity, settings.securityStreamMinSeverity)
  ) {
    if (settings.securityStreamSinkId) {
      selectedSinkIds.add(settings.securityStreamSinkId);
    } else {
      for (const sink of sinks) {
        const filter = normalizeEventFilter(sink.eventFilter as Record<string, unknown>);
        if (isSecuritySinkCandidate(filter)) {
          selectedSinkIds.add(sink.id);
        }
      }
    }
  }

  if (selectedSinkIds.size === 0) {
    return;
  }

  await args.prisma.auditDeliveryQueue.createMany({
    data: Array.from(selectedSinkIds).map((sinkId) => ({
      sinkId,
      auditLogId: args.auditLogId,
      workspaceId: args.workspaceId,
      status: 'queued',
      attemptCount: 0,
      nextAttemptAt: new Date(),
      lastError: null,
    })),
    skipDuplicates: true,
  });
}

export async function processAuditDeliveryQueue(args: {
  prisma: PrismaClient;
  batchSize?: number;
}): Promise<{ processed: number; delivered: number; failed: number; retried: number }> {
  const now = new Date();
  const batchSize = Math.min(Math.max(args.batchSize || 50, 1), 500);

  const rows = await args.prisma.auditDeliveryQueue.findMany({
    where: {
      status: 'queued',
      nextAttemptAt: {
        lte: now,
      },
    },
    include: {
      sink: true,
      auditLog: true,
      workspace: {
        select: {
          key: true,
        },
      },
    },
    orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
    take: batchSize,
  });

  let processed = 0;
  let delivered = 0;
  let failed = 0;
  let retried = 0;

  for (const row of rows) {
    const claimed = await args.prisma.auditDeliveryQueue.updateMany({
      where: {
        id: row.id,
        status: 'queued',
      },
      data: {
        status: 'sending',
      },
    });
    if (claimed.count === 0) {
      continue;
    }

    processed += 1;
    const retryPolicy = normalizeRetryPolicy(row.sink.retryPolicy as Record<string, unknown>);
    const attemptNumber = row.attemptCount + 1;
    const payload = {
      delivery_id: row.id,
      workspace_key: row.workspace.key,
      action_key: row.auditLog.action,
      created_at: row.auditLog.createdAt.toISOString(),
      actor_user_id: row.auditLog.actorUserId,
      correlation_id: row.auditLog.correlationId,
      project_id: row.auditLog.projectId,
      params: toObject(row.auditLog.target),
    };

    try {
      if (!row.sink.enabled) {
        throw new Error('sink is disabled');
      }
      const response = await postSignedDelivery({
        endpointUrl: row.sink.endpointUrl,
        secret: row.sink.secret,
        workspaceKey: row.workspace.key,
        actionKey: row.auditLog.action,
        deliveryId: row.id,
        body: payload,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      await args.prisma.auditDeliveryQueue.update({
        where: { id: row.id },
        data: {
          status: 'delivered',
          attemptCount: attemptNumber,
          lastError: null,
        },
      });
      delivered += 1;
    } catch (error) {
      const maxAttempts = retryPolicy.maxAttempts;
      const backoff = pickBackoffSeconds(retryPolicy, attemptNumber);
      const isExhausted = attemptNumber >= maxAttempts;
      await args.prisma.auditDeliveryQueue.update({
        where: { id: row.id },
        data: {
          status: isExhausted ? 'failed' : 'queued',
          attemptCount: attemptNumber,
          nextAttemptAt: new Date(Date.now() + backoff * 1000),
          lastError: toErrorMessage(error),
        },
      });
      if (isExhausted) {
        failed += 1;
      } else {
        retried += 1;
      }
    }
  }

  return { processed, delivered, failed, retried };
}

function toAuditSinkResponse(row: {
  id: string;
  type: 'webhook' | 'http';
  name: string;
  enabled: boolean;
  endpointUrl: string;
  secret: string;
  eventFilter: unknown;
  retryPolicy: unknown;
  createdAt: Date;
  updatedAt: Date;
}): AuditSinkListItem {
  const filter = normalizeEventFilter(row.eventFilter as Record<string, unknown>);
  const retry = normalizeRetryPolicy(row.retryPolicy as Record<string, unknown>);
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    enabled: row.enabled,
    endpoint_url: row.endpointUrl,
    has_secret: Boolean(row.secret),
    event_filter: {
      include_prefixes: filter.includePrefixes,
      exclude_actions: filter.excludeActions,
    },
    retry_policy: {
      max_attempts: retry.maxAttempts,
      backoff_sec: retry.backoffSec,
    },
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function normalizeAuditSinkUrl(input: string): string {
  const value = String(input || '').trim();
  if (!value) {
    throw new ValidationError('endpoint_url is required.');
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ValidationError('endpoint_url must be a valid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('endpoint_url must use http or https.');
  }
  if (parsed.username || parsed.password) {
    throw new ValidationError('endpoint_url must not include username/password.');
  }
  if (!allowPrivateAuditSinkUrls() && isPrivateOrLocalHost(parsed.hostname)) {
    throw new ValidationError(
      'endpoint_url host points to local/private network. Set MEMORY_CORE_ALLOW_PRIVATE_AUDIT_SINK_URLS=true only for trusted development setups.'
    );
  }
  return parsed.toString();
}

function allowPrivateAuditSinkUrls(): boolean {
  const value = String(process.env.MEMORY_CORE_ALLOW_PRIVATE_AUDIT_SINK_URLS || '')
    .trim()
    .toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) {
    return true;
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }
  if (host === '::1') {
    return true;
  }
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    if (host.startsWith('127.')) {
      return true;
    }
    if (host.startsWith('10.')) {
      return true;
    }
    if (host.startsWith('192.168.')) {
      return true;
    }
    if (host.startsWith('169.254.')) {
      return true;
    }
    const secondOctet = Number(host.split('.')[1] || '');
    if (host.startsWith('172.') && Number.isFinite(secondOctet) && secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
    return false;
  }
  if (ipVersion === 6) {
    return host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80') || host === '::1';
  }
  return false;
}

function normalizeEventFilter(input: Record<string, unknown> | undefined): EventFilter {
  const includePrefixes = toStringArray(input?.include_prefixes);
  const excludeActions = toStringArray(input?.exclude_actions);
  return {
    includePrefixes,
    excludeActions,
  };
}

function normalizeRetryPolicy(input: Record<string, unknown> | undefined): RetryPolicy {
  const rawMaxAttempts = Number(input?.max_attempts ?? DEFAULT_RETRY_POLICY.maxAttempts);
  const maxAttempts = Number.isInteger(rawMaxAttempts)
    ? Math.min(Math.max(rawMaxAttempts, 1), 20)
    : DEFAULT_RETRY_POLICY.maxAttempts;

  const backoffSec = Array.isArray(input?.backoff_sec)
    ? input.backoff_sec
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 1)
        .map((value) => Math.floor(value))
        .slice(0, 20)
    : [];

  return {
    maxAttempts,
    backoffSec: backoffSec.length > 0 ? backoffSec : [...DEFAULT_RETRY_POLICY.backoffSec],
  };
}

function toStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((item) => String(item || '').trim())
    .filter((item) => item.length > 0)
    .slice(0, 200);
}

function shouldQueueByFilter(action: string, filter: EventFilter): boolean {
  if (filter.excludeActions.includes(action)) {
    return false;
  }
  if (filter.includePrefixes.length === 0) {
    return true;
  }
  return filter.includePrefixes.some((prefix) => action.startsWith(prefix));
}

function isSecuritySinkCandidate(filter: EventFilter): boolean {
  if (filter.includePrefixes.length === 0) {
    return true;
  }
  return filter.includePrefixes.some((prefix) =>
    SECURITY_PREFIXES.some((securityPrefix) => prefix.startsWith(securityPrefix))
  );
}

function pickBackoffSeconds(policy: RetryPolicy, attemptNumber: number): number {
  if (policy.backoffSec.length === 0) {
    return 60;
  }
  const index = Math.min(Math.max(attemptNumber - 1, 0), policy.backoffSec.length - 1);
  return policy.backoffSec[index];
}

async function postSignedDelivery(args: {
  endpointUrl: string;
  secret: string;
  workspaceKey: string;
  actionKey: string;
  deliveryId: string;
  body: Record<string, unknown>;
}): Promise<Response> {
  const bodyJson = JSON.stringify(args.body);
  const signature = crypto.createHmac('sha256', args.secret).update(bodyJson).digest('hex');
  return fetch(args.endpointUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-claustrum-event': args.actionKey,
      'x-claustrum-workspace': args.workspaceKey,
      'x-claustrum-delivery': args.deliveryId,
      'x-claustrum-signature': `sha256=${signature}`,
      'user-agent': 'claustrum-audit-delivery/1.0',
    },
    body: bodyJson,
  });
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function toObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function toPrismaJson(input: Record<string, unknown>): Prisma.InputJsonValue {
  return input as Prisma.InputJsonValue;
}
