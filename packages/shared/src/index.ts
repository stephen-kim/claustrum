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
  limit?: number;
  since?: string;
};

export const resolutionKindSchema = z.enum([
  'github_remote',
  'repo_root_slug',
  'manual',
]);

export type ResolutionKind = z.infer<typeof resolutionKindSchema>;

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
  github_key_prefix: z.string().min(1).default('github:'),
  local_key_prefix: z.string().min(1).default('local:'),
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
