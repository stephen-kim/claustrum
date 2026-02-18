import express from 'express';
import { z } from 'zod';
import type { MemoryCoreService } from '../../service/index.js';
import type { AuthedRequest } from '../types.js';

export function registerCoreSettingsDecisionIntegrationsRoutes(
  app: express.Express,
  service: MemoryCoreService
): void {
  app.get('/v1/decision-keyword-policies', async (req, res, next) => {
    try {
      const query = z.object({ workspace_key: z.string().min(1) }).parse(req.query);
      const result = await service.listDecisionKeywordPolicies({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/decision-keyword-policies', async (req, res, next) => {
    try {
      const body = z
        .object({
          workspace_key: z.string().min(1),
          name: z.string().min(1),
          positive_keywords: z.array(z.string().min(1)).optional(),
          negative_keywords: z.array(z.string().min(1)).optional(),
          file_path_positive_patterns: z.array(z.string().min(1)).optional(),
          file_path_negative_patterns: z.array(z.string().min(1)).optional(),
          weight_positive: z.coerce.number().min(0).max(100).optional(),
          weight_negative: z.coerce.number().min(0).max(100).optional(),
          enabled: z.boolean().optional(),
          reason: z.string().max(500).optional(),
        })
        .parse(req.body);
      const result = await service.createDecisionKeywordPolicy({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        input: body,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/v1/decision-keyword-policies/:id', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z
        .object({
          workspace_key: z.string().min(1),
          name: z.string().min(1).optional(),
          positive_keywords: z.array(z.string().min(1)).optional(),
          negative_keywords: z.array(z.string().min(1)).optional(),
          file_path_positive_patterns: z.array(z.string().min(1)).optional(),
          file_path_negative_patterns: z.array(z.string().min(1)).optional(),
          weight_positive: z.coerce.number().min(0).max(100).optional(),
          weight_negative: z.coerce.number().min(0).max(100).optional(),
          enabled: z.boolean().optional(),
          reason: z.string().max(500).optional(),
        })
        .parse(req.body);
      const result = await service.updateDecisionKeywordPolicy({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        policyId: params.id,
        input: body,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/v1/decision-keyword-policies/:id', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const query = z
        .object({
          workspace_key: z.string().min(1),
          reason: z.string().max(500).optional(),
        })
        .parse(req.query);
      const result = await service.deleteDecisionKeywordPolicy({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        policyId: params.id,
        reason: query.reason,
      });
      res.json(result);
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
}
