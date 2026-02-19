import {
  IntegrationProvider,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import type { SlackAuditNotifier, SlackDeliveryConfig } from '../../integrations/audit-slack-notifier.js';
import type { AuditReasoner } from '../../integrations/audit-reasoner.js';
import { withAutoReason } from '../audit-utils.js';
import { renderOutboundForWorkspace } from './outbound-message-helpers.js';
import {
  getConfigBoolean,
  getConfigStringArray,
  getConfigSlackRoutes,
  getConfigSlackSeverityRules,
  getConfigString,
  toJsonObject,
} from '../integration-utils.js';
import {
  getEffectiveAuditReasonerConfig,
  type AuditReasonerEnvConfig,
} from '../audit-reasoner-config.js';
import { enqueueAuditDeliveriesForLog } from './audit-sink-helpers.js';

type DbClient = PrismaClient | Prisma.TransactionClient;

export type RecordAuditEntryArgs = {
  prisma: PrismaClient;
  auditSlackNotifier?: SlackAuditNotifier;
  auditReasoner?: AuditReasoner;
  integrationLockedProviders: ReadonlySet<IntegrationProvider>;
  auditReasonerEnvConfig: AuditReasonerEnvConfig;
  workspaceId: string;
  projectId?: string;
  workspaceKey?: string;
  actorUserId: string;
  actorUserEmail?: string;
  action: string;
  target: Record<string, unknown>;
  correlationId?: string;
};

export async function recordAuditEntry(args: RecordAuditEntryArgs): Promise<void> {
  const target = withAutoReason(args.action, args.target);
  const inferredCorrelationId = (() => {
    if (typeof args.correlationId === 'string' && args.correlationId.trim()) {
      return args.correlationId.trim();
    }
    const fromTarget = target.correlation_id;
    if (typeof fromTarget === 'string' && fromTarget.trim()) {
      return fromTarget.trim();
    }
    return null;
  })();
  const created = await args.prisma.auditLog.create({
    data: {
      workspaceId: args.workspaceId,
      projectId: args.projectId || null,
      actorUserId: args.actorUserId,
      correlationId: inferredCorrelationId,
      action: args.action,
      target: target as Prisma.InputJsonValue,
    },
  });

  void enqueueAuditDeliveriesForLog({
    prisma: args.prisma,
    auditLogId: created.id,
    workspaceId: args.workspaceId,
    action: args.action,
    target,
  }).catch(() => {
    // Keep request path non-blocking if sink queue enqueue fails.
  });

  void (async () => {
    let resolvedTarget = target;
    if (args.auditReasoner) {
      try {
        const reasonSource =
          typeof target.reason_source === 'string' ? target.reason_source : 'heuristic';
        if (reasonSource !== 'user') {
          const reasonerConfig = await getEffectiveAuditReasonerConfig({
            prisma: args.prisma,
            workspaceId: args.workspaceId,
            integrationLockedProviders: args.integrationLockedProviders,
            auditReasonerEnvConfig: args.auditReasonerEnvConfig,
          });
          if (reasonerConfig) {
            const aiReason = await args.auditReasoner.generateReason(reasonerConfig, {
              workspaceId: args.workspaceId,
              projectId: args.projectId,
              actorUserId: args.actorUserId,
              correlationId: inferredCorrelationId || undefined,
              action: args.action,
              actorUserEmail: args.actorUserEmail,
              target,
            });
            if (aiReason) {
              resolvedTarget = {
                ...target,
                reason: aiReason.reason,
                reason_source: 'ai',
                reason_provider: aiReason.provider,
                reason_model: aiReason.model,
              };
            }
          }
        }
      } catch {
        // Ignore AI reason generation failures to keep request path non-blocking.
      }
    }

    if (!args.auditSlackNotifier) {
      return;
    }
    try {
      const workspaceSlackConfig = await getWorkspaceSlackDeliveryConfig({
        prisma: args.prisma,
        workspaceId: args.workspaceId,
        integrationLockedProviders: args.integrationLockedProviders,
      });
      if (!args.auditSlackNotifier.shouldNotify(args.action, workspaceSlackConfig)) {
        return;
      }
      let outboundText: string | undefined;
      let outboundLocale: string | undefined;
      try {
        const rendered = await renderOutboundForWorkspace({
          prisma: args.prisma,
          workspaceId: args.workspaceId,
          integrationType: 'slack',
          actionKey: args.action,
          params: resolvedTarget,
        });
        outboundText = rendered.text;
        outboundLocale = rendered.locale_used;
      } catch {
        // Keep Slack forwarding non-blocking if outbound rendering fails.
      }
      await args.auditSlackNotifier.notify(
        {
          workspaceId: args.workspaceId,
          workspaceKey: args.workspaceKey,
          actorUserId: args.actorUserId,
          actorUserEmail: args.actorUserEmail,
          action: args.action,
          target: resolvedTarget,
          createdAt: created.createdAt,
          outboundText,
          outboundLocale,
        },
        workspaceSlackConfig
      );
    } catch {
      // Ignore Slack forwarding failures to keep request path non-blocking.
    }
  })();
}

export async function getWorkspaceSlackDeliveryConfig(args: {
  prisma: DbClient;
  workspaceId: string;
  integrationLockedProviders: ReadonlySet<IntegrationProvider>;
}): Promise<SlackDeliveryConfig | undefined> {
  if (args.integrationLockedProviders.has(IntegrationProvider.slack)) {
    return undefined;
  }
  const row = await args.prisma.workspaceIntegration.findUnique({
    where: {
      workspaceId_provider: {
        workspaceId: args.workspaceId,
        provider: IntegrationProvider.slack,
      },
    },
  });
  if (!row) {
    return undefined;
  }
  if (!row.isEnabled) {
    return { enabled: false };
  }
  const config = toJsonObject(row.config);
  return {
    enabled: row.isEnabled,
    webhookUrl: getConfigString(config, 'webhook_url'),
    actionPrefixes: getConfigStringArray(config, 'action_prefixes'),
    defaultChannel: getConfigString(config, 'default_channel'),
    format: getConfigString(config, 'format') === 'compact' ? 'compact' : 'detailed',
    includeTargetJson: getConfigBoolean(config, 'include_target_json') ?? true,
    maskSecrets: getConfigBoolean(config, 'mask_secrets') ?? true,
    routes: getConfigSlackRoutes(config, 'routes'),
    severityRules: getConfigSlackSeverityRules(config, 'severity_rules'),
  };
}
