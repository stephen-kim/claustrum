import express from 'express';
import { z } from 'zod';
import { monorepoModeSchema, resolutionKindSchema } from '@claustrum/shared';
import type { MemoryCoreService } from '../../service/index.js';
import type { AuthedRequest } from '../types.js';

export function registerCoreSettingsWorkspaceRoutes(
  app: express.Express,
  service: MemoryCoreService
): void {
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
          auto_confirm_allowed_event_types: z
            .array(z.enum(['post_commit', 'post_merge', 'post_checkout']))
            .optional(),
          auto_confirm_keyword_allowlist: z.array(z.string().min(1)).optional(),
          auto_confirm_keyword_denylist: z.array(z.string().min(1)).optional(),
          auto_extraction_batch_size: z.coerce.number().int().positive().max(2000).optional(),
          enable_activity_auto_log: z.boolean().optional(),
          enable_decision_extraction: z.boolean().optional(),
          decision_extraction_mode: z.enum(['llm_only', 'hybrid_priority']).optional(),
          decision_default_status: z.enum(['draft', 'confirmed']).optional(),
          decision_auto_confirm_enabled: z.boolean().optional(),
          decision_auto_confirm_min_confidence: z.coerce.number().min(0).max(1).optional(),
          decision_batch_size: z.coerce.number().int().positive().max(2000).optional(),
          decision_backfill_days: z.coerce.number().int().positive().max(3650).optional(),
          raw_access_min_role: z.enum(['OWNER', 'MAINTAINER', 'WRITER', 'READER']).optional(),
          retention_policy_enabled: z.boolean().optional(),
          audit_retention_days: z.coerce.number().int().positive().max(3650).optional(),
          raw_retention_days: z.coerce.number().int().positive().max(3650).optional(),
          retention_mode: z.enum(['archive', 'hard_delete']).optional(),
          security_stream_enabled: z.boolean().optional(),
          security_stream_sink_id: z.string().uuid().nullable().optional(),
          security_stream_min_severity: z.enum(['low', 'medium', 'high']).optional(),
          oidc_sync_mode: z.enum(['add_only', 'add_and_remove']).optional(),
          oidc_allow_auto_provision: z.boolean().optional(),
          search_default_mode: z.enum(['hybrid', 'keyword', 'semantic']).optional(),
          search_hybrid_alpha: z.coerce.number().min(0).max(1).optional(),
          search_hybrid_beta: z.coerce.number().min(0).max(1).optional(),
          search_default_limit: z.coerce.number().int().positive().max(500).optional(),
          search_type_weights: z.record(z.string(), z.coerce.number().min(0).max(100)).optional(),
          search_recency_half_life_days: z.coerce.number().positive().max(3650).optional(),
          search_subpath_boost_weight: z.coerce.number().min(1).max(10).optional(),
          github_auto_create_projects: z.boolean().optional(),
          github_auto_create_subprojects: z.boolean().optional(),
          github_permission_sync_enabled: z.boolean().optional(),
          github_permission_sync_mode: z.enum(['add_only', 'add_and_remove']).optional(),
          github_cache_ttl_seconds: z.coerce.number().int().min(30).max(86400).optional(),
          github_role_mapping: z
            .record(z.string(), z.enum(['owner', 'maintainer', 'writer', 'reader']))
            .optional(),
          github_webhook_enabled: z.boolean().optional(),
          github_webhook_sync_mode: z.enum(['add_only', 'add_and_remove']).optional(),
          github_team_mapping_enabled: z.boolean().optional(),
          github_project_key_prefix: z.string().min(1).optional(),
          github_key_prefix: z.string().min(1).optional(),
          local_key_prefix: z.string().min(1).optional(),
          enable_monorepo_resolution: z.boolean().optional(),
          monorepo_detection_level: z.coerce.number().int().min(0).max(3).optional(),
          monorepo_mode: monorepoModeSchema.optional(),
          monorepo_context_mode: z.enum(['shared_repo', 'split_on_demand', 'split_auto']).optional(),
          monorepo_subpath_metadata_enabled: z.boolean().optional(),
          monorepo_subpath_boost_enabled: z.boolean().optional(),
          monorepo_subpath_boost_weight: z.coerce.number().min(1).max(10).optional(),
          monorepo_root_markers: z.array(z.string().min(1)).optional(),
          monorepo_workspace_globs: z.array(z.string().min(1)).optional(),
          monorepo_exclude_globs: z.array(z.string().min(1)).optional(),
          monorepo_max_depth: z.coerce.number().int().positive().optional(),
          default_outbound_locale: z.enum(['en', 'ko', 'ja', 'es', 'zh']).optional(),
          supported_outbound_locales: z
            .array(z.enum(['en', 'ko', 'ja', 'es', 'zh']))
            .min(1)
            .optional(),
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

  app.get('/v1/extraction-settings', async (req, res, next) => {
    try {
      const query = z.object({ workspace_key: z.string().min(1) }).parse(req.query);
      const settings = await service.getExtractionSettings({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
      });
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  app.put('/v1/extraction-settings', async (req, res, next) => {
    try {
      const body = z
        .object({
          workspace_key: z.string().min(1),
          enable_activity_auto_log: z.boolean().optional(),
          enable_decision_extraction: z.boolean().optional(),
          decision_extraction_mode: z.enum(['llm_only', 'hybrid_priority']).optional(),
          decision_default_status: z.enum(['draft', 'confirmed']).optional(),
          decision_auto_confirm_enabled: z.boolean().optional(),
          decision_auto_confirm_min_confidence: z.coerce.number().min(0).max(1).optional(),
          decision_batch_size: z.coerce.number().int().positive().max(2000).optional(),
          decision_backfill_days: z.coerce.number().int().positive().max(3650).optional(),
          reason: z.string().max(500).optional(),
        })
        .parse(req.body);
      const settings = await service.updateExtractionSettings({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        input: body,
      });
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });
}
