ALTER TABLE "workspace_settings"
  ADD COLUMN IF NOT EXISTS "monorepo_detection_level" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "monorepo_exclude_globs" JSONB NOT NULL DEFAULT '["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", ".next/**"]'::jsonb;

ALTER TABLE "workspace_settings"
  ALTER COLUMN "monorepo_root_markers" SET DEFAULT '["pnpm-workspace.yaml", "turbo.json", "nx.json", "lerna.json"]'::jsonb;
