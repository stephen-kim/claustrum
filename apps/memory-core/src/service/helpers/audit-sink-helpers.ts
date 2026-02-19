import type { PrismaClient } from '@prisma/client';
import { getEffectiveWorkspaceSettings } from '../workspace-resolution.js';
import { isSeverityAtLeast, resolveSecurityClassification } from './security-taxonomy-helpers.js';
import {
  isSecuritySinkCandidate,
  normalizeAuditSinkUrl,
  normalizeEventFilter,
  normalizeRetryPolicy,
  pickBackoffSeconds,
  postSignedDelivery,
  toErrorMessage,
  toObject,
} from './audit-sink-core.js';
import type { AuditSinkDeps } from './audit-sink-types.js';

export {
  createAuditSinkHandler,
  deleteAuditSinkHandler,
  listAuditDeliveryQueueHandler,
  listAuditSinksHandler,
  testAuditSinkDeliveryHandler,
  updateAuditSinkHandler,
} from './audit-sink-management.js';

export { normalizeAuditSinkUrl } from './audit-sink-core.js';
export type { AuditSinkDeps, AuditSinkListItem } from './audit-sink-types.js';

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

function shouldQueueByFilter(
  action: string,
  filter: { includePrefixes: string[]; excludeActions: string[] }
): boolean {
  if (filter.excludeActions.includes(action)) {
    return false;
  }
  if (filter.includePrefixes.length === 0) {
    return true;
  }
  return filter.includePrefixes.some((prefix) => action.startsWith(prefix));
}
