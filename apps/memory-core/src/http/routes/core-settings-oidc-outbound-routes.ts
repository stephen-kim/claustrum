import express from 'express';
import { z } from 'zod';
import {
  outboundIntegrationTypeSchema,
  outboundModeSchema,
  outboundStyleSchema,
} from '@claustrum/shared';
import type { MemoryCoreService } from '../../service/index.js';
import type { AuthedRequest } from '../types.js';

export function registerCoreSettingsOidcOutboundRoutes(
  app: express.Express,
  service: MemoryCoreService
): void {
  app.get('/v1/workspaces/:key/sso-settings', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const result = await service.getWorkspaceSsoSettings({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.put('/v1/workspaces/:key/sso-settings', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const body = z
        .object({
          oidc_sync_mode: z.enum(['add_only', 'add_and_remove']).optional(),
          oidc_allow_auto_provision: z.boolean().optional(),
          reason: z.string().max(500).optional(),
        })
        .parse(req.body);
      const result = await service.updateWorkspaceSsoSettings({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        oidcSyncMode: body.oidc_sync_mode,
        oidcAllowAutoProvision: body.oidc_allow_auto_provision,
        reason: body.reason,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/oidc/providers', async (req, res, next) => {
    try {
      const query = z.object({ workspace_key: z.string().min(1) }).parse(req.query);
      const result = await service.listOidcProviders({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/oidc/providers', async (req, res, next) => {
    try {
      const body = z
        .object({
          workspace_key: z.string().min(1),
          name: z.string().min(1),
          issuer_url: z.string().url(),
          client_id: z.string().min(1),
          client_secret: z.string().min(1),
          discovery_enabled: z.boolean().optional(),
          scopes: z.string().min(1).optional(),
          claim_groups_name: z.string().min(1).optional(),
          claim_groups_format: z.enum(['id', 'name']).optional(),
          enabled: z.boolean().optional(),
          reason: z.string().max(500).optional(),
        })
        .parse(req.body);
      const result = await service.upsertOidcProvider({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        input: body,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/v1/oidc/providers/:id', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z
        .object({
          workspace_key: z.string().min(1),
          name: z.string().min(1).optional(),
          issuer_url: z.string().url().optional(),
          client_id: z.string().min(1).optional(),
          client_secret: z.string().min(1).optional(),
          discovery_enabled: z.boolean().optional(),
          scopes: z.string().min(1).optional(),
          claim_groups_name: z.string().min(1).optional(),
          claim_groups_format: z.enum(['id', 'name']).optional(),
          enabled: z.boolean().optional(),
          reason: z.string().max(500).optional(),
        })
        .parse(req.body);
      const result = await service.upsertOidcProvider({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        providerId: params.id,
        input: body,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/oidc/group-mappings', async (req, res, next) => {
    try {
      const query = z
        .object({
          workspace_key: z.string().min(1),
          provider_id: z.string().uuid().optional(),
        })
        .parse(req.query);
      const result = await service.listOidcGroupMappings({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        providerId: query.provider_id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/oidc/group-mappings', async (req, res, next) => {
    try {
      const body = z
        .object({
          workspace_key: z.string().min(1),
          provider_id: z.string().uuid(),
          claim_name: z.string().min(1).optional(),
          group_id: z.string().min(1),
          group_display_name: z.string().min(1),
          target_type: z.enum(['workspace', 'project']),
          target_key: z.string().min(1),
          role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'MAINTAINER', 'WRITER', 'READER']),
          priority: z.coerce.number().int().min(0).max(100000).optional(),
          enabled: z.boolean().optional(),
          reason: z.string().max(500).optional(),
        })
        .parse(req.body);
      const result = await service.upsertOidcGroupMapping({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        input: body,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/v1/oidc/group-mappings/:id', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z
        .object({
          workspace_key: z.string().min(1),
          provider_id: z.string().uuid(),
          claim_name: z.string().min(1).optional(),
          group_id: z.string().min(1).optional(),
          group_display_name: z.string().min(1).optional(),
          target_type: z.enum(['workspace', 'project']).optional(),
          target_key: z.string().min(1).optional(),
          role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'MAINTAINER', 'WRITER', 'READER']).optional(),
          priority: z.coerce.number().int().min(0).max(100000).optional(),
          enabled: z.boolean().optional(),
          reason: z.string().max(500).optional(),
        })
        .parse(req.body);
      const result = await service.upsertOidcGroupMapping({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        mappingId: params.id,
        input: body,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/v1/oidc/group-mappings/:id', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const query = z
        .object({
          workspace_key: z.string().min(1),
          reason: z.string().max(500).optional(),
        })
        .parse(req.query);
      const result = await service.deleteOidcGroupMapping({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        mappingId: params.id,
        reason: query.reason,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/workspaces/:key/outbound-settings', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const result = await service.getWorkspaceOutboundSettings({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.put('/v1/workspaces/:key/outbound-settings', async (req, res, next) => {
    try {
      const params = z.object({ key: z.string().min(1) }).parse(req.params);
      const body = z
        .object({
          default_outbound_locale: z.enum(['en', 'ko', 'ja', 'es', 'zh']).optional(),
          supported_outbound_locales: z.array(z.enum(['en', 'ko', 'ja', 'es', 'zh'])).min(1).optional(),
          reason: z.string().max(500).optional(),
        })
        .parse(req.body);
      const result = await service.updateWorkspaceOutboundSettings({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: params.key,
        defaultOutboundLocale: body.default_outbound_locale,
        supportedOutboundLocales: body.supported_outbound_locales,
        reason: body.reason,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/outbound-policies/:integration_type', async (req, res, next) => {
    try {
      const params = z.object({ integration_type: outboundIntegrationTypeSchema }).parse(req.params);
      const query = z.object({ workspace_key: z.string().min(1) }).parse(req.query);
      const result = await service.getOutboundPolicy({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        integrationType: params.integration_type,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.put('/v1/outbound-policies/:integration_type', async (req, res, next) => {
    try {
      const params = z.object({ integration_type: outboundIntegrationTypeSchema }).parse(req.params);
      const body = z
        .object({
          workspace_key: z.string().min(1),
          enabled: z.boolean().optional(),
          locale_default: z.enum(['en', 'ko', 'ja', 'es', 'zh']).optional(),
          supported_locales: z.array(z.enum(['en', 'ko', 'ja', 'es', 'zh'])).min(1).optional(),
          mode: outboundModeSchema.optional(),
          style: outboundStyleSchema.optional(),
          template_overrides: z.record(z.unknown()).optional(),
          llm_prompt_system: z.string().nullable().optional(),
          llm_prompt_user: z.string().nullable().optional(),
          reason: z.string().max(500).optional(),
        })
        .parse(req.body);
      const result = await service.updateOutboundPolicy({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        integrationType: params.integration_type,
        enabled: body.enabled,
        localeDefault: body.locale_default,
        supportedLocales: body.supported_locales,
        mode: body.mode,
        style: body.style,
        templateOverrides: body.template_overrides,
        llmPromptSystem: body.llm_prompt_system,
        llmPromptUser: body.llm_prompt_user,
        reason: body.reason,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/outbound/render', async (req, res, next) => {
    try {
      const body = z
        .object({
          workspace_key: z.string().min(1),
          integration_type: outboundIntegrationTypeSchema,
          action_key: z.string().min(1),
          params: z.record(z.unknown()).optional(),
          locale: z.enum(['en', 'ko', 'ja', 'es', 'zh']).optional(),
        })
        .parse(req.body);
      const result = await service.renderOutbound({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        integrationType: body.integration_type,
        actionKey: body.action_key,
        params: body.params,
        locale: body.locale,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/outbound/template-variables', async (req, res, next) => {
    try {
      const query = z
        .object({
          workspace_key: z.string().min(1),
          integration_type: outboundIntegrationTypeSchema.default('slack'),
        })
        .parse(req.query);
      const result = await service.listOutboundTemplateVariables({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        integrationType: query.integration_type,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
}
