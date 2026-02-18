import express from 'express';
import { z } from 'zod';
import type { MemoryCoreService } from '../../service/index.js';
import type { AuthedRequest } from '../types.js';
import { createRateLimitMiddleware } from '../rate-limit.js';

export function registerGithubRoutes(app: express.Express, service: MemoryCoreService): void {
  const webhookRateLimit = createRateLimitMiddleware({
    name: 'github.webhook',
    max: 1200,
    windowMs: 60_000,
    message: 'GitHub webhook rate limit exceeded.',
  });

  app.post('/v1/webhooks/github', webhookRateLimit, async (req, res, next) => {
    try {
      const headers = z
        .object({
          event: z.string().min(1),
          delivery: z.string().min(1),
          signature256: z.string().min(1),
        })
        .parse({
          event: req.header('x-github-event'),
          delivery: req.header('x-github-delivery'),
          signature256: req.header('x-hub-signature-256'),
        });
      const rawBody =
        ((req as express.Request & { rawBody?: Buffer }).rawBody as Buffer | undefined) ||
        Buffer.from(JSON.stringify(req.body || {}), 'utf8');
      const result = await service.enqueueGithubWebhookEvent({
        eventType: headers.event,
        deliveryId: headers.delivery,
        signature256: headers.signature256,
        payload: req.body,
        payloadRaw: rawBody,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/workspaces/:key/github/install-url', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const result = await service.getGithubInstallUrl({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/auth/github/callback', async (req, res, next) => {
    try {
      const query = z
        .object({
          installation_id: z.string().min(1),
          state: z.string().min(1),
        })
        .parse(req.query);
      const result = await service.connectGithubInstallation({
        installationId: query.installation_id,
        state: query.state,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/workspaces/:key/github/installation', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const result = await service.getGithubInstallationStatus({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/workspaces/:key/github/sync-repos', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const body = z
        .object({
          repos: z.array(z.string().min(1)).max(500).optional(),
        })
        .default({})
        .parse(req.body || {});
      const result = await service.syncGithubRepos({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        repos: body.repos,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/workspaces/:key/github/repos', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const result = await service.listGithubRepos({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/workspaces/:key/github/user-links', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const result = await service.listGithubUserLinks({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/workspaces/:key/github/user-links', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const body = z
        .object({
          user_id: z.string().min(1),
          github_login: z.string().min(1),
        })
        .parse(req.body);
      const result = await service.createGithubUserLink({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        userId: body.user_id,
        githubLogin: body.github_login,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/v1/workspaces/:key/github/user-links/:userId', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1), userId: z.string().min(1) }).parse(req.params);
      const result = await service.deleteGithubUserLink({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        userId: params.userId,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/workspaces/:key/github/sync-permissions', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const body = z
        .object({
          dry_run: z.boolean().optional(),
          project_key_prefix: z.string().min(1).optional(),
          repos: z.array(z.string().min(1)).max(500).optional(),
        })
        .default({})
        .parse(req.body || {});
      const result = await service.syncGithubPermissions({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        dryRun: body.dry_run,
        projectKeyPrefix: body.project_key_prefix,
        repos: body.repos,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/workspaces/:key/github/permission-preview', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const query = z
        .object({
          repo: z.string().min(1),
        })
        .parse(req.query);
      const result = await service.getGithubPermissionPreview({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        repo: query.repo,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/workspaces/:key/github/cache-status', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const result = await service.getGithubCacheStatus({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/workspaces/:key/github/permission-status', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const result = await service.getGithubPermissionStatus({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/workspaces/:key/github/webhook-events', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const query = z
        .object({
          status: z.enum(['queued', 'processing', 'done', 'failed']).optional(),
          limit: z.coerce.number().int().positive().max(200).optional(),
        })
        .parse(req.query);
      const result = await service.listGithubWebhookEvents({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        status: query.status,
        limit: query.limit,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/workspaces/:key/github/team-mappings', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const result = await service.listGithubTeamMappings({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/workspaces/:key/github/team-mappings', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const body = z
        .object({
          provider_installation_id: z.string().min(1).nullable().optional(),
          github_team_id: z.string().min(1),
          github_team_slug: z.string().min(1),
          github_org_login: z.string().min(1),
          target_type: z.enum(['workspace', 'project']),
          target_key: z.string().min(1),
          role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'MAINTAINER', 'WRITER', 'READER']),
          enabled: z.boolean().optional(),
          priority: z.coerce.number().int().min(0).max(100000).optional(),
        })
        .parse(req.body);
      const result = await service.createGithubTeamMapping({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        input: {
          providerInstallationId: body.provider_installation_id,
          githubTeamId: body.github_team_id,
          githubTeamSlug: body.github_team_slug,
          githubOrgLogin: body.github_org_login,
          targetType: body.target_type,
          targetKey: body.target_key,
          role: body.role,
          enabled: body.enabled,
          priority: body.priority,
        },
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/v1/workspaces/:key/github/team-mappings/:id', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1), id: z.string().uuid() }).parse(req.params);
      const body = z
        .object({
          provider_installation_id: z.string().min(1).nullable().optional(),
          github_team_id: z.string().min(1).optional(),
          github_team_slug: z.string().min(1).optional(),
          github_org_login: z.string().min(1).optional(),
          target_type: z.enum(['workspace', 'project']).optional(),
          target_key: z.string().min(1).optional(),
          role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'MAINTAINER', 'WRITER', 'READER']).optional(),
          enabled: z.boolean().optional(),
          priority: z.coerce.number().int().min(0).max(100000).optional(),
        })
        .parse(req.body || {});
      const result = await service.patchGithubTeamMapping({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        mappingId: params.id,
        input: {
          providerInstallationId: body.provider_installation_id,
          githubTeamId: body.github_team_id,
          githubTeamSlug: body.github_team_slug,
          githubOrgLogin: body.github_org_login,
          targetType: body.target_type,
          targetKey: body.target_key,
          role: body.role,
          enabled: body.enabled,
          priority: body.priority,
        },
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/v1/workspaces/:key/github/team-mappings/:id', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1), id: z.string().uuid() }).parse(req.params);
      const result = await service.deleteGithubTeamMapping({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        mappingId: params.id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
}
