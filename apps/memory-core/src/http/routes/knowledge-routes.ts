import express from 'express';
import { z } from 'zod';
import type { MemoryCoreService } from '../../service/index.js';
import type { AuthedRequest } from '../types.js';
import { createRateLimitMiddleware } from '../rate-limit.js';

export function registerKnowledgeRoutes(app: express.Express, service: MemoryCoreService): void {
  const auditExportRateLimit = createRateLimitMiddleware({
    name: 'audit.export',
    max: 20,
    windowMs: 5 * 60_000,
    message: 'Audit export rate limit exceeded. Please retry later.',
    keyResolver: (req) => (req as AuthedRequest).auth?.user.id || req.ip || 'anonymous',
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
          project_key: z.string().min(1).optional(),
          limit: z.coerce.number().int().positive().optional(),
          actor_user_id: z.string().min(1).optional(),
          action_key: z.string().min(1).optional(),
          action_prefix: z.string().optional(),
        })
        .parse(req.query);
      const logs = await service.listAuditLogs({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        limit: query.limit,
        projectKey: query.project_key,
        actorUserId: query.actor_user_id,
        actionKey: query.action_key,
        actionPrefix: query.action_prefix,
      });
      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/audit/access-timeline', async (req, res, next) => {
    try {
      const query = z
        .object({
          workspace_key: z.string().min(1),
          project_key: z.string().min(1).optional(),
          user_id: z.string().min(1).optional(),
          source: z.enum(['manual', 'github', 'oidc', 'system']).optional(),
          action: z.string().min(1).optional(),
          from: z.string().min(1).optional(),
          to: z.string().min(1).optional(),
          limit: z.coerce.number().int().positive().optional(),
          cursor: z.string().min(1).optional(),
        })
        .parse(req.query);
      const timeline = await service.listAccessAuditTimeline({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        projectKey: query.project_key,
        userId: query.user_id,
        source: query.source,
        action: query.action,
        from: query.from,
        to: query.to,
        limit: query.limit,
        cursor: query.cursor,
      });
      res.json(timeline);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/audit/export', auditExportRateLimit, async (req, res, next) => {
    try {
      const query = z
        .object({
          workspace_key: z.string().min(1),
          project_key: z.string().min(1).optional(),
          from: z.string().min(1).optional(),
          to: z.string().min(1).optional(),
          format: z.enum(['csv', 'json']).default('csv'),
          source: z.enum(['manual', 'github', 'oidc', 'system']).optional(),
          action: z.string().min(1).optional(),
        })
        .parse(req.query);
      const exported = await service.createAuditExportStream({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        projectKey: query.project_key,
        from: query.from,
        to: query.to,
        format: query.format,
        source: query.source,
        action: query.action,
      });
      res.setHeader('Content-Type', exported.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=\"${exported.filename}\"`);

      for await (const chunk of exported.stream) {
        res.write(chunk);
      }
      res.end();
    } catch (error) {
      next(error);
    }
  });
}
