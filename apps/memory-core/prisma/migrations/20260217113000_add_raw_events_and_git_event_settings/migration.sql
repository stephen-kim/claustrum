DO $$
BEGIN
  CREATE TYPE "RawEventType" AS ENUM ('post_commit', 'post_merge', 'post_checkout');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workspace_settings"
  ADD COLUMN IF NOT EXISTS "enable_git_events" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_commit_events" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_merge_events" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_checkout_events" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "checkout_debounce_seconds" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "checkout_daily_limit" INTEGER NOT NULL DEFAULT 200;

CREATE TABLE IF NOT EXISTS "raw_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "event_type" "RawEventType" NOT NULL,
  "repo_key" TEXT NOT NULL,
  "subproject_key" TEXT,
  "branch" TEXT,
  "from_branch" TEXT,
  "to_branch" TEXT,
  "commit_sha" TEXT,
  "commit_message" TEXT,
  "changed_files" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raw_events_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "raw_events"
    ADD CONSTRAINT "raw_events_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "raw_events"
    ADD CONSTRAINT "raw_events_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "raw_events_project_id_event_type_created_at_idx"
  ON "raw_events"("project_id", "event_type", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "raw_events_workspace_id_created_at_idx"
  ON "raw_events"("workspace_id", "created_at" DESC);
