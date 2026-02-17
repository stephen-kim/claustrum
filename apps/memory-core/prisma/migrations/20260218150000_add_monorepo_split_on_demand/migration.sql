DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MonorepoContextMode') THEN
    CREATE TYPE "MonorepoContextMode_next" AS ENUM (
      'shared_repo',
      'split_on_demand',
      'split_auto',
      'split_subproject'
    );

    ALTER TABLE "workspace_settings"
      ALTER COLUMN "monorepo_context_mode" DROP DEFAULT;

    ALTER TABLE "workspace_settings"
      ALTER COLUMN "monorepo_context_mode" TYPE "MonorepoContextMode_next"
      USING (
        CASE "monorepo_context_mode"::text
          WHEN 'split_subproject' THEN 'split_auto'
          ELSE "monorepo_context_mode"::text
        END
      )::"MonorepoContextMode_next";

    DROP TYPE "MonorepoContextMode";
    ALTER TYPE "MonorepoContextMode_next" RENAME TO "MonorepoContextMode";

    ALTER TABLE "workspace_settings"
      ALTER COLUMN "monorepo_context_mode" SET DEFAULT 'shared_repo';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "monorepo_subproject_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" TEXT NOT NULL,
  "repo_key" TEXT NOT NULL,
  "subpath" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "monorepo_subproject_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "monorepo_subproject_policies_workspace_id_repo_key_subpath_key"
  ON "monorepo_subproject_policies" ("workspace_id", "repo_key", "subpath");

CREATE INDEX IF NOT EXISTS "monorepo_subproject_policies_workspace_id_repo_key_enabled_updated_at_idx"
  ON "monorepo_subproject_policies" ("workspace_id", "repo_key", "enabled", "updated_at" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'monorepo_subproject_policies_workspace_id_fkey'
  ) THEN
    ALTER TABLE "monorepo_subproject_policies"
      ADD CONSTRAINT "monorepo_subproject_policies_workspace_id_fkey"
      FOREIGN KEY ("workspace_id")
      REFERENCES "workspaces"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END$$;
