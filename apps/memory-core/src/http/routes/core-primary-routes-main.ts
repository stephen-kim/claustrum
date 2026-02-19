import express from 'express';
import { z } from 'zod';
import {
  createMemorySchema,
  createProjectSchema,
  memorySourceSchema,
  memoryStatusSchema,
  memoryTypeSchema,
  resolveProjectSchema,
} from '@claustrum/shared';
import type { MemoryCoreService } from '../../service/index.js';
import type { AuthedRequest } from '../types.js';

const workspaceRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
const projectRoleSchema = z.enum(['OWNER', 'MAINTAINER', 'WRITER', 'READER']);

export function registerCorePrimaryMainRoutes(app: express.Express, service: MemoryCoreService): void {
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
      const input = resolveProjectSchema.parse(req.body);
      const data = await service.resolveProject({
        auth: (req as AuthedRequest).auth!,
        input,
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/memories', async (req, res, next) => {
    try {
      const input = createMemorySchema.parse(req.body);
      const data = await service.createMemory({
        auth: (req as AuthedRequest).auth!,
        input,
      });
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/onboarding/git-capture-installed', async (req, res, next) => {
    try {
      const body = z
        .object({
          workspace_key: z.string().min(1),
          project_key: z.string().min(1).optional(),
          metadata: z.record(z.unknown()).optional(),
        })
        .parse(req.body);
      const result = await service.reportGitCaptureInstalled({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        projectKey: body.project_key,
        metadata: body.metadata,
      });
      res.json(result);
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
          current_subpath: z.string().optional(),
          type: memoryTypeSchema.optional(),
          q: z.string().optional(),
          mode: z.enum(['hybrid', 'keyword', 'semantic']).optional(),
          status: memoryStatusSchema.optional(),
          source: memorySourceSchema.optional(),
          confidence_min: z.coerce.number().min(0).max(1).optional(),
          confidence_max: z.coerce.number().min(0).max(1).optional(),
          debug: z.coerce.boolean().optional(),
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

  app.get('/v1/context/bundle', async (req, res, next) => {
    try {
      const query = z
        .object({
          workspace_key: z.string().min(1),
          project_key: z.string().min(1),
          q: z.string().optional(),
          current_subpath: z.string().optional(),
          mode: z.enum(['default', 'debug']).optional(),
          budget: z.coerce.number().int().positive().max(50000).optional(),
        })
        .parse(req.query);
      const data = await service.getContextBundle({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        projectKey: query.project_key,
        q: query.q,
        currentSubpath: query.current_subpath,
        mode: query.mode,
        budget: query.budget,
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/context/persona-recommendation', async (req, res, next) => {
    try {
      const query = z
        .object({
          workspace_key: z.string().min(1),
          project_key: z.string().min(1),
          q: z.string().optional(),
        })
        .parse(req.query);
      const data = await service.getContextPersonaRecommendation({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        projectKey: query.project_key,
        q: query.q,
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/usage/llm', async (req, res, next) => {
    try {
      const query = z
        .object({
          workspace_key: z.string().min(1),
          from: z.string().datetime().optional(),
          to: z.string().datetime().optional(),
          group_by: z.enum(['day', 'purpose', 'model']).default('day'),
        })
        .parse(req.query);
      const data = await service.listLlmUsage({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        from: query.from,
        to: query.to,
        groupBy: query.group_by,
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/decisions', async (req, res, next) => {
    try {
      const query = z
        .object({
          workspace_key: z.string().min(1),
          project_key: z.string().optional(),
          q: z.string().optional(),
          mode: z.enum(['hybrid', 'keyword', 'semantic']).optional(),
          status: memoryStatusSchema.optional(),
          source: memorySourceSchema.optional(),
          confidence_min: z.coerce.number().min(0).max(1).optional(),
          confidence_max: z.coerce.number().min(0).max(1).optional(),
          debug: z.coerce.boolean().optional(),
          limit: z.coerce.number().int().positive().optional(),
          since: z.string().datetime().optional(),
        })
        .parse(req.query);

      const data = await service.listDecisions({
        auth: (req as AuthedRequest).auth!,
        query,
      });
      res.json({ decisions: data });
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/decisions/:id', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().min(1) }).parse(req.params);
      const query = z.object({ workspace_key: z.string().min(1) }).parse(req.query);
      const result = await service.getDecision({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        decisionId: params.id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/decisions/:id/confirm', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().min(1) }).parse(req.params);
      const body = z.object({ workspace_key: z.string().min(1) }).parse(req.body);
      const result = await service.setDecisionStatus({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        decisionId: params.id,
        status: 'confirmed',
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/decisions/:id/reject', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().min(1) }).parse(req.params);
      const body = z.object({ workspace_key: z.string().min(1) }).parse(req.body);
      const result = await service.setDecisionStatus({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        decisionId: params.id,
        status: 'rejected',
      });
      res.json(result);
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

  app.delete('/v1/memories/:id', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().min(1) }).parse(req.params);
      const result = await service.deleteMemory({
        auth: (req as AuthedRequest).auth!,
        memoryId: params.id,
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
      const input = createProjectSchema.parse(req.body);
      const project = await service.createProject({
        auth: (req as AuthedRequest).auth!,
        input,
      });
      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/projects/:key/bootstrap', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const body = z.object({ workspace_key: z.string().min(1) }).parse(req.body);
      const data = await service.bootstrapProjectContext({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        projectKey: params.key,
      });
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/projects/:key/recompute-active-work', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const body = z.object({ workspace_key: z.string().min(1) }).parse(req.body);
      const data = await service.recomputeProjectActiveWork({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        projectKey: params.key,
      });
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/projects/:key/active-work', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const query = z
        .object({
          workspace_key: z.string().min(1),
          include_closed: z.coerce.boolean().optional(),
          limit: z.coerce.number().int().positive().max(200).optional(),
        })
        .parse(req.query);
      const data = await service.listProjectActiveWork({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        projectKey: params.key,
        includeClosed: query.include_closed,
        limit: query.limit,
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/projects/:key/active-work/events', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const query = z
        .object({
          workspace_key: z.string().min(1),
          active_work_id: z.string().uuid().optional(),
          limit: z.coerce.number().int().positive().max(500).optional(),
        })
        .parse(req.query);
      const data = await service.listProjectActiveWorkEvents({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        projectKey: params.key,
        activeWorkId: query.active_work_id,
        limit: query.limit,
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/active-work/:id/confirm', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z
        .object({
          workspace_key: z.string().min(1),
          project_key: z.string().min(1),
        })
        .parse(req.body);
      const data = await service.updateProjectActiveWorkStatus({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        projectKey: body.project_key,
        activeWorkId: params.id,
        action: 'confirm',
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/active-work/:id/pin', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z
        .object({
          workspace_key: z.string().min(1),
          project_key: z.string().min(1),
        })
        .parse(req.body);
      const data = await service.updateProjectActiveWorkStatus({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        projectKey: body.project_key,
        activeWorkId: params.id,
        action: 'confirm',
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/active-work/:id/close', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z
        .object({
          workspace_key: z.string().min(1),
          project_key: z.string().min(1),
        })
        .parse(req.body);
      const data = await service.updateProjectActiveWorkStatus({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        projectKey: body.project_key,
        activeWorkId: params.id,
        action: 'close',
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/active-work/:id/reopen', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z
        .object({
          workspace_key: z.string().min(1),
          project_key: z.string().min(1),
        })
        .parse(req.body);
      const data = await service.updateProjectActiveWorkStatus({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        projectKey: body.project_key,
        activeWorkId: params.id,
        action: 'reopen',
      });
      res.json(data);
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

  app.put('/v1/workspaces/:key', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const body = z
        .object({
          name: z.string().min(1),
        })
        .parse(req.body);
      const workspace = await service.updateWorkspace({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        name: body.name,
      });
      res.json(workspace);
    } catch (error) {
      next(error);
    }
  });
}
