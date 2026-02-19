import express from 'express';
import { z } from 'zod';
import { memorySourceSchema, memoryStatusSchema, memoryTypeSchema } from '@claustrum/shared';
import type { MemoryCoreService } from '../../service/index.js';
import type { AuthedRequest } from '../types.js';

const workspaceRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
const projectRoleSchema = z.enum(['OWNER', 'MAINTAINER', 'WRITER', 'READER']);


export function registerCorePrimaryAccessRoutes(app: express.Express, service: MemoryCoreService): void {
  app.get('/v1/workspaces/:key/members', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const members = await service.listWorkspaceMembers({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
      });
      res.json({ members });
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/workspaces/:key/members', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const body = z
        .object({
          email: z.string().email(),
          role: workspaceRoleSchema.default('MEMBER'),
        })
        .parse(req.body);
      const member = await service.addWorkspaceMember({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        email: body.email,
        role: body.role,
      });
      res.status(201).json(member);
    } catch (error) {
      next(error);
    }
  });

  app.put('/v1/workspaces/:key/members/:userId', async (req, res, next) => {
    try {
      const params = z
        .object({
          key: z.string().min(1),
          userId: z.string().min(1),
        })
        .parse(req.params);
      const body = z
        .object({
          role: workspaceRoleSchema,
        })
        .parse(req.body);
      const member = await service.updateWorkspaceMemberRole({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        userId: params.userId,
        role: body.role,
      });
      res.json(member);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/v1/workspaces/:key/members/:userId', async (req, res, next) => {
    try {
      const params = z
        .object({
          key: z.string().min(1),
          userId: z.string().min(1),
        })
        .parse(req.params);
      const result = await service.removeWorkspaceMember({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        userId: params.userId,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/workspaces/:key/api-keys', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const query = z
        .object({
          user_id: z.string().min(1).optional(),
        })
        .parse(req.query);
      const result = await service.listWorkspaceApiKeys({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        userId: query.user_id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/workspaces/:key/api-keys', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const body = z
        .object({
          user_id: z.string().min(1),
          label: z.string().min(1).max(100).optional(),
          device_label: z.string().min(1).max(120),
          expires_at: z.string().datetime().optional(),
        })
        .parse(req.body);
      const result = await service.issueWorkspaceApiKey({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        userId: body.user_id,
        label: body.label,
        deviceLabel: body.device_label,
        expiresAt: body.expires_at,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/v1/workspaces/:key/api-keys/:apiKeyId', async (req, res, next) => {
    try {
      const params = z
        .object({
          key: z.string().min(1),
          apiKeyId: z.string().min(1),
        })
        .parse(req.params);
      const result = await service.revokeWorkspaceApiKey({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        apiKeyId: params.apiKeyId,
      });
      res.json(result);
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
          role: projectRoleSchema.default('READER'),
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

  app.get('/v1/projects/:key/members', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const query = z
        .object({
          workspace_key: z.string().min(1),
        })
        .parse(req.query);
      const members = await service.listProjectMembers({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        projectKey: params.key,
      });
      res.json({ members });
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/projects/:key/members', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const body = z
        .object({
          workspace_key: z.string().min(1),
          email: z.string().email(),
          role: projectRoleSchema.default('READER'),
        })
        .parse(req.body);
      const member = await service.addProjectMember({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        projectKey: params.key,
        email: body.email,
        role: body.role,
      });
      res.status(201).json(member);
    } catch (error) {
      next(error);
    }
  });

  app.put('/v1/projects/:key/members/:userId', async (req, res, next) => {
    try {
      const params = z
        .object({
          key: z.string().min(1),
          userId: z.string().min(1),
        })
        .parse(req.params);
      const body = z
        .object({
          workspace_key: z.string().min(1),
          role: projectRoleSchema,
        })
        .parse(req.body);
      const member = await service.updateProjectMemberRole({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        projectKey: params.key,
        userId: params.userId,
        role: body.role,
      });
      res.json(member);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/v1/projects/:key/members/:userId', async (req, res, next) => {
    try {
      const params = z
        .object({
          key: z.string().min(1),
          userId: z.string().min(1),
        })
        .parse(req.params);
      const query = z
        .object({
          workspace_key: z.string().min(1),
        })
        .parse(req.query);
      const result = await service.removeProjectMember({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        projectKey: params.key,
        userId: params.userId,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
}
