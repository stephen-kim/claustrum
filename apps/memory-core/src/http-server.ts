import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { z } from 'zod';
import { extractBearerToken, authenticateBearerToken } from './auth.js';
import { loadConfig } from './config.js';
import { Logger } from './logger.js';
import { getPrismaClient } from './prisma.js';
import {
  AuthenticationError,
  AuthorizationError,
  GoneError,
  MemoryCoreService,
  NotFoundError,
  ValidationError,
} from './service/index.js';
import { NotionClientAdapter } from './integrations/notion-client.js';
import { JiraClientAdapter } from './integrations/jira-client.js';
import { ConfluenceClientAdapter } from './integrations/confluence-client.js';
import { LinearClientAdapter } from './integrations/linear-client.js';
import { SlackAuditNotifier } from './integrations/audit-slack-notifier.js';
import { AuditReasoner } from './integrations/audit-reasoner.js';
import { LlmClient } from './integrations/llm-client.js';
import { recordLlmUsageEvent } from './service/helpers/llm-usage-helpers.js';
import { toLockedIntegrationProviders } from './http/locked-integration-providers.js';
import { registerV1Routes } from './http/routes/register-v1-routes.js';
import type { AuthedRequest } from './http/types.js';
import { sendHttpError } from './http/error-shape.js';
import { bootstrapAdminIfNeeded } from './bootstrap-admin.js';

const config = loadConfig();
const logger = new Logger(config.logLevel);
const prisma = getPrismaClient();

const envIntegrationEnabled = !config.integrationIgnoreEnv;
const notionClient =
  envIntegrationEnabled && config.notionToken
    ? new NotionClientAdapter(config.notionToken, config.notionDefaultParentPageId)
    : undefined;
const jiraClient =
  envIntegrationEnabled && config.jiraBaseUrl && config.jiraEmail && config.jiraApiToken
    ? new JiraClientAdapter(config.jiraBaseUrl, config.jiraEmail, config.jiraApiToken)
    : undefined;
const confluenceClient =
  envIntegrationEnabled &&
  config.confluenceBaseUrl &&
  config.confluenceEmail &&
  config.confluenceApiToken
    ? new ConfluenceClientAdapter(
        config.confluenceBaseUrl,
        config.confluenceEmail,
        config.confluenceApiToken
      )
    : undefined;
const linearClient =
  envIntegrationEnabled && config.linearApiKey
    ? new LinearClientAdapter(config.linearApiKey, config.linearApiUrl)
    : undefined;
const auditSlackNotifier = envIntegrationEnabled
  ? new SlackAuditNotifier({
      webhookUrl: config.auditSlackWebhookUrl,
      actionPrefixes: config.auditSlackActionPrefixes,
      defaultChannel: config.auditSlackDefaultChannel,
      format: config.auditSlackFormat,
      includeTargetJson: config.auditSlackIncludeTargetJson,
      maskSecrets: config.auditSlackMaskSecrets,
      logger,
    })
  : undefined;
const llmClient = new LlmClient(logger, async (event) => {
  await recordLlmUsageEvent({
    prisma,
    usage: event,
  });
});
const auditReasoner = new AuditReasoner(logger, llmClient);

const service = new MemoryCoreService(
  prisma,
  notionClient,
  config.notionWriteEnabled,
  jiraClient,
  confluenceClient,
  linearClient,
  auditSlackNotifier,
  auditReasoner,
  llmClient,
  toLockedIntegrationProviders(config.integrationLockedProviders),
  {
    enabled: envIntegrationEnabled ? config.auditReasonerEnabled : false,
    preferEnv: envIntegrationEnabled ? config.auditReasonerPreferEnv : false,
    providerOrder: envIntegrationEnabled ? config.auditReasonerProviderOrder : [],
    providers: {
      openai: {
        model: config.auditReasonerOpenAiModel,
        apiKey: envIntegrationEnabled ? config.auditReasonerOpenAiApiKey : undefined,
        baseUrl: config.auditReasonerOpenAiBaseUrl,
      },
      claude: {
        model: config.auditReasonerClaudeModel,
        apiKey: envIntegrationEnabled ? config.auditReasonerClaudeApiKey : undefined,
        baseUrl: config.auditReasonerClaudeBaseUrl,
      },
      gemini: {
        model: config.auditReasonerGeminiModel,
        apiKey: envIntegrationEnabled ? config.auditReasonerGeminiApiKey : undefined,
        baseUrl: config.auditReasonerGeminiBaseUrl,
      },
    },
  },
  {
    apiKeyHashSecret: config.apiKeyHashSecret,
    oneTimeTokenSecret: config.oneTimeTokenSecret,
    oneTimeTokenTtlSeconds: config.oneTimeTokenTtlSeconds,
    githubStateSecret: config.githubStateSecret,
    publicBaseUrl: config.publicBaseUrl,
    inviteBaseUrl: config.inviteBaseUrl,
    githubAppId: config.githubAppId,
    githubAppPrivateKey: config.githubAppPrivateKey,
    githubAppWebhookSecret: config.githubAppWebhookSecret,
    githubAppName: config.githubAppName,
    githubAppUrl: config.githubAppUrl,
  }
);

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

app.use(cors());
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  })
);

app.use((req, res, next) => {
  const incoming = String(req.header('x-request-id') || '').trim();
  const requestId = incoming || crypto.randomUUID();
  (req as AuthedRequest).requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const auth = (req as AuthedRequest).auth;
    const message = [
      `request_id=${requestId}`,
      `method=${req.method}`,
      `path=${req.originalUrl || req.url}`,
      `status=${res.statusCode}`,
      `duration_ms=${elapsedMs.toFixed(1)}`,
      `user_id=${auth?.user.id || 'anonymous'}`,
      `auth_method=${auth?.authMethod || 'none'}`,
    ].join(' ');

    if (res.statusCode >= 500) {
      logger.error(message);
      return;
    }
    if (res.statusCode >= 400) {
      logger.warn(message);
      return;
    }
    logger.debug(message);
  });
  next();
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.use('/v1', async (req, res, next) => {
  try {
    const path = req.path || '';
    if (
      path.startsWith('/webhooks/github') ||
      path === '/auth/login' ||
      path.startsWith('/auth/oidc/') ||
      path.startsWith('/auth/github/callback') ||
      path.startsWith('/api-keys/one-time/') ||
      path.startsWith('/invite/')
    ) {
      return next();
    }
    const token = extractBearerToken(req.header('authorization'));
    if (!token) {
      return sendHttpError({
        res,
        status: 401,
        code: 'missing_bearer_token',
        message: 'Missing Authorization: Bearer <token>',
      });
    }

    const auth = await authenticateBearerToken({
      prisma,
      token,
      envApiKeys: config.apiKeys,
      sessionSecret: config.authSessionSecret,
      apiKeyHashSecret: config.apiKeyHashSecret,
    });
    if (!auth) {
      return sendHttpError({
        res,
        status: 401,
        code: 'invalid_credentials',
        message: 'Invalid credentials',
      });
    }

    const setupAllowedPaths = new Set(['/auth/me', '/auth/complete-setup', '/auth/logout']);
    if (auth.mustChangePassword && !setupAllowedPaths.has(path)) {
      return sendHttpError({
        res,
        status: 403,
        code: 'setup_required',
        message: 'Initial setup is required. Complete POST /v1/auth/complete-setup before using other APIs.',
      });
    }

    (req as AuthedRequest).auth = auth;
    return next();
  } catch (error) {
    return next(error);
  }
});

registerV1Routes(app, service, upload, {
  sessionSecret: config.authSessionSecret,
  sessionTtlSeconds: config.authSessionTtlSeconds,
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ValidationError || error instanceof z.ZodError) {
    if (error instanceof z.ZodError) {
      return sendHttpError({
        res,
        status: 400,
        code: 'validation_error',
        message: error.issues.map((issue) => issue.message).join(', '),
        details: {
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            code: issue.code,
            message: issue.message,
          })),
        },
      });
    }
    return sendHttpError({
      res,
      status: 400,
      code: 'validation_error',
      message: error.message,
    });
  }

  if (error instanceof AuthenticationError) {
    return sendHttpError({
      res,
      status: 401,
      code: 'authentication_error',
      message: error.message,
    });
  }

  if (error instanceof AuthorizationError) {
    return sendHttpError({
      res,
      status: 403,
      code: 'authorization_error',
      message: error.message,
    });
  }

  if (error instanceof NotFoundError) {
    return sendHttpError({
      res,
      status: 404,
      code: 'not_found',
      message: error.message,
    });
  }

  if (error instanceof GoneError) {
    return sendHttpError({
      res,
      status: 410,
      code: 'gone',
      message: error.message,
    });
  }

  logger.error('Unhandled request error', error);
  return sendHttpError({
    res,
    status: 500,
    code: 'internal_error',
    message: 'Internal server error',
  });
});

async function startServer() {
  await bootstrapAdminIfNeeded({
    prisma,
    enabled: config.allowBootstrapAdmin,
  });
  let webhookWorkerRunning = false;
  let auditDeliveryWorkerRunning = false;
  let detectionWorkerRunning = false;
  let retentionWorkerRunning = false;
  let retentionLastRunDay = '';
  let activeWorkWorkerRunning = false;
  let activeWorkLastRunDay = '';
  setInterval(() => {
    if (webhookWorkerRunning) {
      return;
    }
    webhookWorkerRunning = true;
    void service
      .processGithubWebhookQueue({ batchSize: 20 })
      .catch((error) => {
        logger.warn(`GitHub webhook worker failed: ${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        webhookWorkerRunning = false;
      });
  }, 3000);
  setInterval(() => {
    if (auditDeliveryWorkerRunning) {
      return;
    }
    auditDeliveryWorkerRunning = true;
    void service
      .processAuditDeliveryQueue({ batchSize: 50 })
      .then((result) => {
        if (result.processed > 0) {
          logger.info(
            `Audit delivery worker: processed=${result.processed}, delivered=${result.delivered}, retried=${result.retried}, failed=${result.failed}`
          );
        }
      })
      .catch((error) => {
        logger.warn(
          `Audit delivery worker failed: ${error instanceof Error ? error.message : String(error)}`
        );
      })
      .finally(() => {
        auditDeliveryWorkerRunning = false;
      });
  }, 3000);
  setInterval(() => {
    if (detectionWorkerRunning) {
      return;
    }
    detectionWorkerRunning = true;
    void service
      .runDetectionSweep({ now: new Date(), batchSize: 500 })
      .then((result) => {
        if (result.rules_processed > 0 || result.detections_created > 0) {
          logger.info(
            `Detection sweep: workspaces=${result.workspaces_processed}, rules=${result.rules_processed}, detections=${result.detections_created}`
          );
        }
      })
      .catch((error) => {
        logger.warn(`Detection sweep failed: ${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        detectionWorkerRunning = false;
      });
  }, 60 * 1000);
  setInterval(() => {
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    if (retentionLastRunDay === dayKey || retentionWorkerRunning) {
      return;
    }
    retentionWorkerRunning = true;
    void service
      .runAuditRetentionSweep({ now })
      .then((result) => {
        retentionLastRunDay = dayKey;
        logger.info(
          `Retention sweep complete: workspaces=${result.workspaces_processed}, archived=${result.archived_count}, deleted=${result.deleted_count}, raw_deleted=${result.raw_deleted_count}`
        );
      })
      .catch((error) => {
        logger.warn(`Retention sweep failed: ${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        retentionWorkerRunning = false;
      });
  }, 60 * 60 * 1000);
  setInterval(() => {
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    if (activeWorkLastRunDay === dayKey || activeWorkWorkerRunning) {
      return;
    }
    activeWorkWorkerRunning = true;
    void service
      .runActiveWorkNightly({ now })
      .then((result) => {
        activeWorkLastRunDay = dayKey;
        logger.info(
          `Active-work nightly recompute: workspaces=${result.workspaces_processed}, projects=${result.projects_processed}, changed=${result.changed_projects}`
        );
      })
      .catch((error) => {
        logger.warn(`Active-work nightly recompute failed: ${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        activeWorkWorkerRunning = false;
      });
  }, 60 * 60 * 1000);
  app.listen(config.port, config.host, () => {
    logger.info(`HTTP server listening on ${config.host}:${config.port}`);
  });
}

void startServer().catch((error) => {
  logger.error('Failed to start HTTP server', error);
  process.exit(1);
});
