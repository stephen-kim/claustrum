import express from 'express';
import { z } from 'zod';
import type { MemoryCoreService } from '../../service/index.js';
import type { AuthedRequest } from '../types.js';
import { createRateLimitMiddleware } from '../rate-limit.js';

export function registerAuthRoutes(
  app: express.Express,
  service: MemoryCoreService,
  authConfig: { sessionSecret: string; sessionTtlSeconds: number }
): void {
  const loginRateLimit = createRateLimitMiddleware({
    name: 'auth.login',
    max: 10,
    windowMs: 60_000,
    message: 'Too many login attempts. Please try again shortly.',
  });

  app.get('/v1/auth/oidc/:workspace_key/start', async (req, res, next) => {
    try {
      const params = z.object({ workspace_key: z.string().min(1) }).parse(req.params);
      const query = z
        .object({
          provider_id: z.string().uuid().optional(),
        })
        .parse(req.query);
      const requestBaseUrl = `${req.protocol}://${req.get('host') || ''}`;
      const result = await service.startOidcLogin({
        workspaceKey: params.workspace_key,
        requestBaseUrl,
        providerId: query.provider_id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/auth/oidc/:workspace_key/callback', async (req, res, next) => {
    try {
      const params = z.object({ workspace_key: z.string().min(1) }).parse(req.params);
      const query = z
        .object({
          code: z.string().min(1),
          state: z.string().min(1),
        })
        .parse(req.query);
      const result = await service.finishOidcLogin({
        workspaceKey: params.workspace_key,
        code: query.code,
        state: query.state,
        sessionSecret: authConfig.sessionSecret,
        sessionTtlSeconds: authConfig.sessionTtlSeconds,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/auth/login', loginRateLimit, async (req, res, next) => {
    try {
      const body = z
        .object({
          email: z.string().email(),
          password: z.string().min(1),
        })
        .parse(req.body);
      const result = await service.login({
        email: body.email,
        password: body.password,
        sessionSecret: authConfig.sessionSecret,
        sessionTtlSeconds: authConfig.sessionTtlSeconds,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/auth/me', async (req, res, next) => {
    try {
      const result = await service.getAuthMe({
        auth: (req as AuthedRequest).auth!,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/auth/logout', async (req, res, next) => {
    try {
      const result = await service.logout({
        auth: (req as AuthedRequest).auth!,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/auth/complete-setup', async (req, res, next) => {
    try {
      const body = z
        .object({
          new_email: z.string().email(),
          new_password: z.string().min(12),
          name: z.string().max(200).optional(),
        })
        .parse(req.body);
      const result = await service.completeSetup({
        auth: (req as AuthedRequest).auth!,
        newEmail: body.new_email,
        newPassword: body.new_password,
        name: body.name,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
}
