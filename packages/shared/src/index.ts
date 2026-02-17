import { z } from 'zod';

export const memoryTypeSchema = z.enum([
  'active_work',
  'constraint',
  'problem',
  'goal',
  'decision',
  'note',
  'caveat',
]);

export type MemoryType = z.infer<typeof memoryTypeSchema>;
export const memoryStatusSchema = z.enum(['draft', 'confirmed', 'rejected']);
export type MemoryStatus = z.infer<typeof memoryStatusSchema>;
export const memorySourceSchema = z.enum(['auto', 'human', 'import']);
export type MemorySource = z.infer<typeof memorySourceSchema>;

export const createProjectSchema = z.object({
  workspace_key: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
});

export const createMemorySchema = z.object({
  workspace_key: z.string().min(1),
  project_key: z.string().min(1),
  type: memoryTypeSchema,
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  status: memoryStatusSchema.optional(),
  source: memorySourceSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateMemoryInput = z.infer<typeof createMemorySchema>;

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName?: string | null;
  source: 'database' | 'env';
  envAdmin?: boolean;
};

export type ListMemoriesQuery = {
  workspace_key: string;
  project_key?: string;
  type?: MemoryType;
  q?: string;
  mode?: 'hybrid' | 'keyword' | 'semantic';
  status?: MemoryStatus;
  source?: MemorySource;
  confidence_min?: number;
  confidence_max?: number;
  limit?: number;
  since?: string;
};

export const resolutionKindSchema = z.enum([
  'github_remote',
  'repo_root_slug',
  'manual',
]);

export type ResolutionKind = z.infer<typeof resolutionKindSchema>;

export const monorepoModeSchema = z.enum([
  'repo_only',
  'repo_hash_subpath',
  'repo_colon_subpath',
]);

export type MonorepoMode = z.infer<typeof monorepoModeSchema>;

export const defaultMonorepoRootMarkers = [
  'pnpm-workspace.yaml',
  'turbo.json',
  'nx.json',
  'lerna.json',
] as const;

export const defaultMonorepoWorkspaceGlobs = ['apps/*', 'packages/*'] as const;
export const defaultMonorepoExcludeGlobs = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '.next/**',
] as const;

export const defaultCheckoutDebounceSeconds = 30;
export const defaultCheckoutDailyLimit = 200;
export const defaultAutoConfirmAllowedEventTypes = ['post_commit', 'post_merge'] as const;
export const defaultAutoConfirmKeywordAllowlist = [
  'migrate',
  'switch',
  'remove',
  'deprecate',
  'rename',
  'refactor',
] as const;
export const defaultAutoConfirmKeywordDenylist = ['wip', 'tmp', 'debug', 'test', 'try'] as const;

export const resolutionOrderSchema = z
  .array(resolutionKindSchema)
  .length(3)
  .refine((value) => new Set(value).size === 3, 'resolution_order must contain unique kinds');

export const resolveProjectSchema = z.object({
  workspace_key: z.string().min(1),
  github_remote: z
    .object({
      host: z.string().optional(),
      owner: z.string().optional(),
      repo: z.string().optional(),
      normalized: z.string().optional(),
    })
    .optional(),
  repo_root_slug: z.string().min(1).optional(),
  repo_root: z.string().min(1).optional(),
  cwd: z.string().min(1).optional(),
  relative_path: z.string().min(1).optional(),
  monorepo: z
    .object({
      enabled: z.boolean().optional(),
      candidate_subpaths: z.array(z.string().min(1)).max(20).optional(),
    })
    .optional(),
  manual_project_key: z.string().min(1).optional(),
});

export type ResolveProjectInput = z.infer<typeof resolveProjectSchema>;

export const workspaceSettingsSchema = z.object({
  workspace_key: z.string().min(1),
  resolution_order: resolutionOrderSchema.default([
    'github_remote',
    'repo_root_slug',
    'manual',
  ]),
  auto_create_project: z.boolean().default(true),
  auto_create_project_subprojects: z.boolean().default(true),
  auto_switch_repo: z.boolean().default(true),
  auto_switch_subproject: z.boolean().default(false),
  allow_manual_pin: z.boolean().default(true),
  enable_git_events: z.boolean().default(true),
  enable_commit_events: z.boolean().default(true),
  enable_merge_events: z.boolean().default(true),
  enable_checkout_events: z.boolean().default(false),
  checkout_debounce_seconds: z.number().int().min(0).max(3600).default(defaultCheckoutDebounceSeconds),
  checkout_daily_limit: z.number().int().positive().max(50000).default(defaultCheckoutDailyLimit),
  enable_auto_extraction: z.boolean().default(true),
  auto_extraction_mode: z.enum(['draft_only', 'auto_confirm']).default('draft_only'),
  auto_confirm_min_confidence: z.number().min(0).max(1).default(0.85),
  auto_confirm_allowed_event_types: z
    .array(z.enum(['post_commit', 'post_merge', 'post_checkout']))
    .max(20)
    .default([...defaultAutoConfirmAllowedEventTypes]),
  auto_confirm_keyword_allowlist: z
    .array(z.string().min(1))
    .max(200)
    .default([...defaultAutoConfirmKeywordAllowlist]),
  auto_confirm_keyword_denylist: z
    .array(z.string().min(1))
    .max(200)
    .default([...defaultAutoConfirmKeywordDenylist]),
  auto_extraction_batch_size: z.number().int().positive().max(2000).default(20),
  search_default_mode: z.enum(['hybrid', 'keyword', 'semantic']).default('hybrid'),
  search_hybrid_alpha: z.number().min(0).max(1).default(0.6),
  search_hybrid_beta: z.number().min(0).max(1).default(0.4),
  search_default_limit: z.number().int().positive().max(500).default(20),
  github_key_prefix: z.string().min(1).default('github:'),
  local_key_prefix: z.string().min(1).default('local:'),
  enable_monorepo_resolution: z.boolean().default(false),
  monorepo_detection_level: z.number().int().min(0).max(3).default(2),
  monorepo_mode: monorepoModeSchema.default('repo_hash_subpath'),
  monorepo_root_markers: z
    .array(z.string().min(1))
    .max(30)
    .default([...defaultMonorepoRootMarkers]),
  monorepo_workspace_globs: z
    .array(z.string().min(1))
    .max(30)
    .default([...defaultMonorepoWorkspaceGlobs]),
  monorepo_exclude_globs: z
    .array(z.string().min(1))
    .max(50)
    .default([...defaultMonorepoExcludeGlobs]),
  monorepo_max_depth: z.number().int().positive().max(12).default(3),
});

export type WorkspaceSettingsInput = z.infer<typeof workspaceSettingsSchema>;

export const createProjectMappingSchema = z.object({
  workspace_key: z.string().min(1),
  project_key: z.string().min(1),
  kind: resolutionKindSchema,
  external_id: z.string().min(1),
  priority: z.number().int().nonnegative().optional(),
  is_enabled: z.boolean().optional(),
});

export const updateProjectMappingSchema = z.object({
  id: z.string().min(1),
  priority: z.number().int().nonnegative().optional(),
  is_enabled: z.boolean().optional(),
  external_id: z.string().min(1).optional(),
  project_key: z.string().min(1).optional(),
});
