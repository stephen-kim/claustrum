import express from 'express';
import { z } from 'zod';
import { resolutionKindSchema } from '@claustrum/shared';
import type { MemoryCoreService } from '../../service/index.js';
import type { AuthedRequest } from '../types.js';

export function registerCoreSettingsMappingRoutes(
  app: express.Express,
  service: MemoryCoreService
): void {
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

  app.get('/v1/monorepo-subproject-policies', async (req, res, next) => {
    try {
      const query = z
        .object({
          workspace_key: z.string().min(1),
          repo_key: z.string().min(1).optional(),
        })
        .parse(req.query);
      const result = await service.listMonorepoSubprojectPolicies({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        repoKey: query.repo_key,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/monorepo-subproject-policies', async (req, res, next) => {
    try {
      const body = z
        .object({
          workspace_key: z.string().min(1),
          repo_key: z.string().min(1),
          subpath: z.string().min(1),
          enabled: z.boolean().optional(),
          reason: z.string().max(500).optional(),
        })
        .parse(req.body);
      const result = await service.createMonorepoSubprojectPolicy({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        repoKey: body.repo_key,
        subpath: body.subpath,
        enabled: body.enabled,
        reason: body.reason,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/v1/monorepo-subproject-policies/:id', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z
        .object({
          workspace_key: z.string().min(1),
          enabled: z.boolean(),
          reason: z.string().max(500).optional(),
        })
        .parse(req.body);
      const result = await service.updateMonorepoSubprojectPolicy({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        id: params.id,
        enabled: body.enabled,
        reason: body.reason,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/v1/monorepo-subproject-policies/:id', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const query = z
        .object({
          workspace_key: z.string().min(1),
          reason: z.string().max(500).optional(),
        })
        .parse(req.query);
      const result = await service.deleteMonorepoSubprojectPolicy({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        id: params.id,
        reason: query.reason,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
}
