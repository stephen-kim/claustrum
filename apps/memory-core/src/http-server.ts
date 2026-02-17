import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { z } from 'zod';
import { extractBearerToken, authenticateBearerToken } from './auth.js';
import type { AuthContext } from './auth.js';
import { loadConfig } from './config.js';
import { Logger } from './logger.js';
import { getPrismaClient } from './prisma.js';
import {
  AuthorizationError,
  MemoryCoreService,
  NotFoundError,
  ValidationError,
} from './service.js';
import {
  memorySourceSchema,
  memoryStatusSchema,
  memoryTypeSchema,
  monorepoModeSchema,
  resolutionKindSchema,
} from '@claustrum/shared';
import { ImportSource, IntegrationProvider, ProjectRole } from '@prisma/client';
import { NotionClientAdapter } from './integrations/notion-client.js';
import { JiraClientAdapter } from './integrations/jira-client.js';
import { ConfluenceClientAdapter } from './integrations/confluence-client.js';
import { LinearClientAdapter } from './integrations/linear-client.js';
import { SlackAuditNotifier } from './integrations/audit-slack-notifier.js';
import { AuditReasoner } from './integrations/audit-reasoner.js';

const config = loadConfig();
const logger = new Logger(config.logLevel);
const prisma = getPrismaClient();
const envIntegrationEnabled = !config.integrationIgnoreEnv;
const notionClient = envIntegrationEnabled && config.notionToken
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
const linearClient = envIntegrationEnabled && config.linearApiKey
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
const auditReasoner = new AuditReasoner(logger);
const service = new MemoryCoreService(
  prisma,
  notionClient,
  config.notionWriteEnabled,
  jiraClient,
  confluenceClient,
  linearClient,
  auditSlackNotifier,
  auditReasoner,
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
  }
);

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024,
  },
});
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.use('/v1', async (req, res, next) => {
  try {
    const token = extractBearerToken(req.header('authorization'));
    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization: Bearer <key>' });
    }

    const auth = await authenticateBearerToken({
      prisma,
      token,
      envApiKeys: config.apiKeys,
    });
    if (!auth) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    (req as AuthedRequest).auth = auth;
    return next();
  } catch (error) {
    return next(error);
  }
});

app.post('/v1/session/select', async (req, res, next) => {
  try {
    const body = z
      .object({
        workspace_key: z.string().min(1),
        project_key: z.string().min(1),
      })
      .parse(req.body);
    const data = await service.selectSession({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: body.workspace_key,
      projectKey: body.project_key,
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post('/v1/resolve-project', async (req, res, next) => {
  try {
    const data = await service.resolveProject({
      auth: (req as AuthedRequest).auth!,
      input: req.body,
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post('/v1/memories', async (req, res, next) => {
  try {
    const data = await service.createMemory({
      auth: (req as AuthedRequest).auth!,
      input: req.body,
    });
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/memories', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
        project_key: z.string().optional(),
        type: memoryTypeSchema.optional(),
        q: z.string().optional(),
        mode: z.enum(['hybrid', 'keyword', 'semantic']).optional(),
        status: memoryStatusSchema.optional(),
        source: memorySourceSchema.optional(),
        confidence_min: z.coerce.number().min(0).max(1).optional(),
        confidence_max: z.coerce.number().min(0).max(1).optional(),
        limit: z.coerce.number().int().positive().optional(),
        since: z.string().datetime().optional(),
      })
      .parse(req.query);

    const data = await service.listMemories({
      auth: (req as AuthedRequest).auth!,
      query,
    });
    res.json({ memories: data });
  } catch (error) {
    next(error);
  }
});

app.patch('/v1/memories/:id', async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        content: z.string().min(1).optional(),
        status: memoryStatusSchema.optional(),
        source: memorySourceSchema.optional(),
        confidence: z.coerce.number().min(0).max(1).optional(),
        metadata: z.record(z.unknown()).nullable().optional(),
        evidence: z.record(z.unknown()).nullable().optional(),
      })
      .parse(req.body);
    const result = await service.updateMemory({
      auth: (req as AuthedRequest).auth!,
      memoryId: params.id,
      input: body,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/projects', async (req, res, next) => {
  try {
    const query = z.object({ workspace_key: z.string().min(1) }).parse(req.query);
    const data = await service.listProjects({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post('/v1/projects', async (req, res, next) => {
  try {
    const project = await service.createProject({
      auth: (req as AuthedRequest).auth!,
      input: req.body,
    });
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/workspaces', async (req, res, next) => {
  try {
    const workspaces = await service.listWorkspaces({
      auth: (req as AuthedRequest).auth!,
    });
    res.json({ workspaces });
  } catch (error) {
    next(error);
  }
});

app.post('/v1/workspaces', async (req, res, next) => {
  try {
    const body = z
      .object({
        key: z.string().min(1),
        name: z.string().min(1),
      })
      .parse(req.body);
    const workspace = await service.createWorkspace({
      auth: (req as AuthedRequest).auth!,
      key: body.key,
      name: body.name,
    });
    res.status(201).json(workspace);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/users', async (req, res, next) => {
  try {
    const users = await service.listUsers({
      auth: (req as AuthedRequest).auth!,
    });
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

app.post('/v1/users', async (req, res, next) => {
  try {
    const body = z
      .object({
        email: z.string().email(),
        name: z.string().optional(),
      })
      .parse(req.body);
    const user = await service.createUser({
      auth: (req as AuthedRequest).auth!,
      email: body.email,
      name: body.name,
    });
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/project-members', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
        project_key: z.string().min(1),
      })
      .parse(req.query);

    const members = await service.listProjectMembers({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
      projectKey: query.project_key,
    });
    res.json({ members });
  } catch (error) {
    next(error);
  }
});

app.post('/v1/project-members', async (req, res, next) => {
  try {
    const body = z
      .object({
        workspace_key: z.string().min(1),
        project_key: z.string().min(1),
        email: z.string().email(),
        role: z.nativeEnum(ProjectRole).default(ProjectRole.MEMBER),
      })
      .parse(req.body);

    const member = await service.addProjectMember({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: body.workspace_key,
      projectKey: body.project_key,
      email: body.email,
      role: body.role,
    });

    res.status(201).json(member);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/workspace-settings', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
      })
      .parse(req.query);
    const settings = await service.getWorkspaceSettings({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
    });
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

app.put('/v1/workspace-settings', async (req, res, next) => {
  try {
    const body = z
      .object({
        workspace_key: z.string().min(1),
        resolution_order: z.array(resolutionKindSchema).optional(),
        auto_create_project: z.boolean().optional(),
        auto_create_project_subprojects: z.boolean().optional(),
        auto_switch_repo: z.boolean().optional(),
        auto_switch_subproject: z.boolean().optional(),
        allow_manual_pin: z.boolean().optional(),
        enable_git_events: z.boolean().optional(),
        enable_commit_events: z.boolean().optional(),
        enable_merge_events: z.boolean().optional(),
        enable_checkout_events: z.boolean().optional(),
        checkout_debounce_seconds: z.coerce.number().int().min(0).max(3600).optional(),
        checkout_daily_limit: z.coerce.number().int().positive().max(50000).optional(),
        enable_auto_extraction: z.boolean().optional(),
        auto_extraction_mode: z.enum(['draft_only', 'auto_confirm']).optional(),
        auto_confirm_min_confidence: z.coerce.number().min(0).max(1).optional(),
        auto_confirm_allowed_event_types: z.array(z.enum(['post_commit', 'post_merge', 'post_checkout'])).optional(),
        auto_confirm_keyword_allowlist: z.array(z.string().min(1)).optional(),
        auto_confirm_keyword_denylist: z.array(z.string().min(1)).optional(),
        auto_extraction_batch_size: z.coerce.number().int().positive().max(2000).optional(),
        search_default_mode: z.enum(['hybrid', 'keyword', 'semantic']).optional(),
        search_hybrid_alpha: z.coerce.number().min(0).max(1).optional(),
        search_hybrid_beta: z.coerce.number().min(0).max(1).optional(),
        search_default_limit: z.coerce.number().int().positive().max(500).optional(),
        github_key_prefix: z.string().min(1).optional(),
        local_key_prefix: z.string().min(1).optional(),
        enable_monorepo_resolution: z.boolean().optional(),
        monorepo_detection_level: z.coerce.number().int().min(0).max(3).optional(),
        monorepo_mode: monorepoModeSchema.optional(),
        monorepo_root_markers: z.array(z.string().min(1)).optional(),
        monorepo_workspace_globs: z.array(z.string().min(1)).optional(),
        monorepo_exclude_globs: z.array(z.string().min(1)).optional(),
        monorepo_max_depth: z.coerce.number().int().positive().optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(req.body);
    const settings = await service.updateWorkspaceSettings({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: body.workspace_key,
      input: body,
    });
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/project-mappings', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
        kind: resolutionKindSchema.optional(),
      })
      .parse(req.query);
    const mappings = await service.listProjectMappings({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
      kind: query.kind,
    });
    res.json({ mappings });
  } catch (error) {
    next(error);
  }
});

app.post('/v1/project-mappings', async (req, res, next) => {
  try {
    const mapping = await service.createProjectMapping({
      auth: (req as AuthedRequest).auth!,
      input: req.body,
    });
    res.status(201).json(mapping);
  } catch (error) {
    next(error);
  }
});

app.patch('/v1/project-mappings', async (req, res, next) => {
  try {
    const mapping = await service.updateProjectMapping({
      auth: (req as AuthedRequest).auth!,
      input: req.body,
    });
    res.json(mapping);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/integrations', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
      })
      .parse(req.query);
    const result = await service.getWorkspaceIntegrations({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.put('/v1/integrations', async (req, res, next) => {
  try {
    const body = z
      .object({
        workspace_key: z.string().min(1),
        provider: z.enum(['notion', 'jira', 'confluence', 'linear', 'slack', 'audit_reasoner']),
        enabled: z.boolean().optional(),
        config: z.record(z.unknown()).optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(req.body);
    const result = await service.upsertWorkspaceIntegration({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: body.workspace_key,
      provider: body.provider,
      enabled: body.enabled,
      config: body.config,
      reason: body.reason,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/imports', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
        limit: z.coerce.number().int().positive().optional(),
      })
      .parse(req.query);
    const imports = await service.listImports({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
      limit: query.limit,
    });
    res.json({ imports });
  } catch (error) {
    next(error);
  }
});

app.post('/v1/imports', upload.single('file'), async (req, res, next) => {
  try {
    const body = z
      .object({
        workspace_key: z.string().min(1),
        source: z.nativeEnum(ImportSource),
        project_key: z.string().min(1).optional(),
      })
      .parse(req.body);
    if (!req.file) {
      return res.status(400).json({ error: 'multipart file is required (field: file)' });
    }

    const result = await service.createImportUpload({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: body.workspace_key,
      source: body.source,
      fileName: req.file.originalname || 'import.dat',
      fileBuffer: req.file.buffer,
      projectKey: body.project_key,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/v1/imports/:id/parse', async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const result = await service.parseImport({
      auth: (req as AuthedRequest).auth!,
      importId: params.id,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/v1/imports/:id/extract', async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const result = await service.extractImport({
      auth: (req as AuthedRequest).auth!,
      importId: params.id,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/imports/:id/staged', async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const staged = await service.listStagedMemories({
      auth: (req as AuthedRequest).auth!,
      importId: params.id,
    });
    res.json({ staged_memories: staged });
  } catch (error) {
    next(error);
  }
});

app.post('/v1/imports/:id/commit', async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        staged_ids: z.array(z.string().uuid()).optional(),
        project_key: z.string().min(1).optional(),
      })
      .parse(req.body);
    const result = await service.commitImport({
      auth: (req as AuthedRequest).auth!,
      importId: params.id,
      stagedIds: body.staged_ids,
      projectKey: body.project_key,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/raw/search', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
        project_key: z.string().min(1).optional(),
        q: z.string().min(1),
        limit: z.coerce.number().int().positive().optional(),
        max_chars: z.coerce.number().int().positive().optional(),
      })
      .parse(req.query);
    const result = await service.rawSearch({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
      projectKey: query.project_key,
      q: query.q,
      limit: query.limit,
      maxChars: query.max_chars,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/raw/messages/:id', async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const query = z
      .object({
        max_chars: z.coerce.number().int().positive().optional(),
      })
      .parse(req.query);
    const result = await service.viewRawMessage({
      auth: (req as AuthedRequest).auth!,
      messageId: params.id,
      maxChars: query.max_chars,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/notion/search', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
        q: z.string().min(1),
        limit: z.coerce.number().int().positive().optional(),
      })
      .parse(req.query);
    const result = await service.notionSearch({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
      query: query.q,
      limit: query.limit,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/notion/read', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
        page_id: z.string().min(1),
        max_chars: z.coerce.number().int().positive().optional(),
      })
      .parse(req.query);
    const result = await service.notionRead({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
      pageId: query.page_id,
      maxChars: query.max_chars,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/v1/notion/write', async (req, res, next) => {
  try {
    const body = z
      .object({
        workspace_key: z.string().min(1),
        title: z.string().min(1),
        content: z.string().min(1),
        page_id: z.string().min(1).optional(),
        parent_page_id: z.string().min(1).optional(),
      })
      .parse(req.body);
    const result = await service.notionWrite({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: body.workspace_key,
      title: body.title,
      content: body.content,
      pageId: body.page_id,
      parentPageId: body.parent_page_id,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/jira/search', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
        q: z.string().min(1),
        limit: z.coerce.number().int().positive().optional(),
      })
      .parse(req.query);
    const result = await service.jiraSearch({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
      query: query.q,
      limit: query.limit,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/jira/read', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
        issue_key: z.string().min(1),
        max_chars: z.coerce.number().int().positive().optional(),
      })
      .parse(req.query);
    const result = await service.jiraRead({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
      issueKey: query.issue_key,
      maxChars: query.max_chars,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/confluence/search', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
        q: z.string().min(1),
        limit: z.coerce.number().int().positive().optional(),
      })
      .parse(req.query);
    const result = await service.confluenceSearch({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
      query: query.q,
      limit: query.limit,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/confluence/read', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
        page_id: z.string().min(1),
        max_chars: z.coerce.number().int().positive().optional(),
      })
      .parse(req.query);
    const result = await service.confluenceRead({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
      pageId: query.page_id,
      maxChars: query.max_chars,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/linear/search', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
        q: z.string().min(1),
        limit: z.coerce.number().int().positive().optional(),
      })
      .parse(req.query);
    const result = await service.linearSearch({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
      query: query.q,
      limit: query.limit,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/linear/read', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
        issue_key: z.string().min(1),
        max_chars: z.coerce.number().int().positive().optional(),
      })
      .parse(req.query);
    const result = await service.linearRead({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
      issueKey: query.issue_key,
      maxChars: query.max_chars,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/audit-logs', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
        limit: z.coerce.number().int().positive().optional(),
        action_prefix: z.string().optional(),
      })
      .parse(req.query);
    const logs = await service.listAuditLogs({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
      limit: query.limit,
      actionPrefix: query.action_prefix,
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

app.post('/v1/git-events', async (req, res, next) => {
  try {
    const body = z
      .object({
        workspace_key: z.string().min(1),
        project_key: z.string().min(1),
        event: z.enum(['commit', 'merge', 'checkout']),
        branch: z.string().min(1).optional(),
        from_branch: z.string().min(1).optional(),
        to_branch: z.string().min(1).optional(),
        commit_hash: z.string().min(7).optional(),
        message: z.string().optional(),
        changed_files: z.array(z.string().min(1)).max(2000).optional(),
        metadata: z.record(z.unknown()).optional(),
      })
      .parse(req.body);
    const eventType =
      body.event === 'commit'
        ? 'post_commit'
        : body.event === 'merge'
          ? 'post_merge'
          : 'post_checkout';
    const result = await service.captureRawEvent({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: body.workspace_key,
      projectKey: body.project_key,
      eventType,
      branch: body.branch,
      fromBranch: body.from_branch,
      toBranch: body.to_branch,
      commitSha: body.commit_hash,
      commitMessage: body.message,
      changedFiles: body.changed_files,
      metadata: body.metadata,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/v1/raw-events', async (req, res, next) => {
  try {
    const body = z
      .object({
        workspace_key: z.string().min(1),
        project_key: z.string().min(1),
        event_type: z.enum(['post_commit', 'post_merge', 'post_checkout']),
        branch: z.string().min(1).optional(),
        from_branch: z.string().min(1).optional(),
        to_branch: z.string().min(1).optional(),
        commit_sha: z.string().min(7).optional(),
        commit_message: z.string().optional(),
        changed_files: z.array(z.string().min(1)).max(2000).optional(),
        metadata: z.record(z.unknown()).optional(),
      })
      .parse(req.body);
    const result = await service.captureRawEvent({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: body.workspace_key,
      projectKey: body.project_key,
      eventType: body.event_type,
      branch: body.branch,
      fromBranch: body.from_branch,
      toBranch: body.to_branch,
      commitSha: body.commit_sha,
      commitMessage: body.commit_message,
      changedFiles: body.changed_files,
      metadata: body.metadata,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/v1/raw-events', async (req, res, next) => {
  try {
    const query = z
      .object({
        workspace_key: z.string().min(1),
        project_key: z.string().optional(),
        event_type: z.enum(['post_commit', 'post_merge', 'post_checkout']).optional(),
        commit_sha: z.string().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        limit: z.coerce.number().int().positive().optional(),
      })
      .parse(req.query);
    const result = await service.listRawEvents({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: query.workspace_key,
      projectKey: query.project_key,
      eventType: query.event_type,
      commitSha: query.commit_sha,
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/v1/ci-events', async (req, res, next) => {
  try {
    const body = z
      .object({
        workspace_key: z.string().min(1),
        status: z.enum(['success', 'failure']),
        provider: z.enum(['github_actions', 'generic']).default('github_actions'),
        project_key: z.string().min(1).optional(),
        workflow_name: z.string().min(1).optional(),
        workflow_run_id: z.union([z.string().min(1), z.number().int().nonnegative()]).optional(),
        workflow_run_url: z.string().url().optional(),
        repository: z.string().min(1).optional(),
        branch: z.string().min(1).optional(),
        sha: z.string().min(7).optional(),
        event_name: z.string().min(1).optional(),
        job_name: z.string().min(1).optional(),
        message: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      })
      .parse(req.body);
    const result = await service.handleCiEvent({
      auth: (req as AuthedRequest).auth!,
      workspaceKey: body.workspace_key,
      status: body.status,
      provider: body.provider,
      projectKey: body.project_key,
      workflowName: body.workflow_name,
      workflowRunId:
        typeof body.workflow_run_id === 'number'
          ? String(body.workflow_run_id)
          : body.workflow_run_id,
      workflowRunUrl: body.workflow_run_url,
      repository: body.repository,
      branch: body.branch,
      sha: body.sha,
      eventName: body.event_name,
      jobName: body.job_name,
      message: body.message,
      metadata: body.metadata,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ValidationError || error instanceof z.ZodError) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(', ')
      : error.message;
    return res.status(400).json({ error: message });
  }

  if (error instanceof AuthorizationError) {
    return res.status(403).json({ error: error.message });
  }

  if (error instanceof NotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  logger.error('Unhandled request error', error);
  return res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, config.host, () => {
  logger.info(`HTTP server listening on ${config.host}:${config.port}`);
});

function toLockedIntegrationProviders(values: readonly string[]): ReadonlySet<IntegrationProvider> {
  const providers = new Set<IntegrationProvider>();
  for (const value of values) {
    if (value === 'notion') {
      providers.add(IntegrationProvider.notion);
      continue;
    }
    if (value === 'jira') {
      providers.add(IntegrationProvider.jira);
      continue;
    }
    if (value === 'confluence') {
      providers.add(IntegrationProvider.confluence);
      continue;
    }
    if (value === 'linear') {
      providers.add(IntegrationProvider.linear);
      continue;
    }
    if (value === 'slack') {
      providers.add(IntegrationProvider.slack);
      continue;
    }
    if (value === 'audit_reasoner') {
      providers.add(IntegrationProvider.audit_reasoner);
    }
  }
  return providers;
}

type AuthedRequest = express.Request & {
  auth?: AuthContext;
};
