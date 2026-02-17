DO $$
BEGIN
  CREATE TYPE "MonorepoMode" AS ENUM ('repo_only', 'repo_hash_subpath', 'repo_colon_subpath');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workspace_settings"
  ADD COLUMN IF NOT EXISTS "auto_create_project_subprojects" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_monorepo_resolution" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "monorepo_mode" "MonorepoMode" NOT NULL DEFAULT 'repo_hash_subpath',
  ADD COLUMN IF NOT EXISTS "monorepo_root_markers" JSONB NOT NULL DEFAULT '["pnpm-workspace.yaml", "turbo.json", "nx.json", "lerna.json", "package.json"]'::jsonb,
  ADD COLUMN IF NOT EXISTS "monorepo_workspace_globs" JSONB NOT NULL DEFAULT '["apps/*", "packages/*"]'::jsonb,
  ADD COLUMN IF NOT EXISTS "monorepo_max_depth" INTEGER NOT NULL DEFAULT 3;
