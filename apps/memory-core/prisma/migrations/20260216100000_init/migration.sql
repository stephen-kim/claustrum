-- Create enums
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "ProjectRole" AS ENUM ('ADMIN', 'MEMBER');
CREATE TYPE "ResolutionKind" AS ENUM ('github_remote', 'repo_root_slug', 'manual');
CREATE TYPE "ImportSource" AS ENUM ('codex', 'claude', 'generic');
CREATE TYPE "ImportStatus" AS ENUM ('uploaded', 'parsed', 'extracted', 'committed', 'failed');

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create tables
CREATE TABLE "workspaces" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workspace_members" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_members" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "ProjectRole" NOT NULL DEFAULT 'MEMBER',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "memories" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "api_keys" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workspace_settings" (
  "workspace_id" TEXT NOT NULL,
  "resolution_order" JSONB NOT NULL DEFAULT '["github_remote", "repo_root_slug", "manual"]'::jsonb,
  "auto_create_project" BOOLEAN NOT NULL DEFAULT true,
  "auto_create_key_prefix" TEXT NOT NULL DEFAULT 'github:',
  "auto_create_local_key_prefix" TEXT NOT NULL DEFAULT 'local:',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("workspace_id")
);

CREATE TABLE "project_mappings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "kind" "ResolutionKind" NOT NULL,
  "external_id" TEXT NOT NULL,
  "priority" INTEGER NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "imports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "source" "ImportSource" NOT NULL,
  "status" "ImportStatus" NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_path" TEXT,
  "stats" JSONB,
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "raw_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" TEXT NOT NULL,
  "project_id" TEXT,
  "import_id" UUID,
  "source" "ImportSource" NOT NULL,
  "source_session_id" TEXT,
  "title" TEXT,
  "started_at" TIMESTAMPTZ,
  "ended_at" TIMESTAMPTZ,
  "metadata" JSONB,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raw_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "raw_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "raw_session_id" UUID NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raw_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staged_memories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "import_id" UUID NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "project_id" TEXT,
  "type" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "is_selected" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staged_memories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "workspaces_key_key" ON "workspaces"("key");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key"
  ON "workspace_members"("workspace_id", "user_id");
CREATE UNIQUE INDEX "projects_workspace_id_key_key"
  ON "projects"("workspace_id", "key");
CREATE UNIQUE INDEX "project_members_project_id_user_id_key"
  ON "project_members"("project_id", "user_id");
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");
CREATE UNIQUE INDEX "project_mappings_workspace_id_kind_external_id_key"
  ON "project_mappings"("workspace_id", "kind", "external_id");
CREATE UNIQUE INDEX "raw_sessions_workspace_id_source_source_session_id_key"
  ON "raw_sessions"("workspace_id", "source", "source_session_id");

-- Required indexes
CREATE INDEX "memories_project_id_type_created_at_idx"
  ON "memories"("project_id", "type", "created_at" DESC);
CREATE INDEX "projects_workspace_id_key_idx"
  ON "projects"("workspace_id", "key");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "workspace_members_workspace_id_role_idx"
  ON "workspace_members"("workspace_id", "role");
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");
CREATE INDEX "memories_workspace_id_created_at_idx"
  ON "memories"("workspace_id", "created_at" DESC);
CREATE INDEX "memories_created_at_idx" ON "memories"("created_at" DESC);
CREATE INDEX "project_mappings_workspace_id_kind_priority_is_enabled_idx"
  ON "project_mappings"("workspace_id", "kind", "priority", "is_enabled");
CREATE INDEX "imports_workspace_id_created_at_idx"
  ON "imports"("workspace_id", "created_at" DESC);
CREATE INDEX "raw_sessions_workspace_id_created_at_idx"
  ON "raw_sessions"("workspace_id", "created_at" DESC);
CREATE INDEX "raw_sessions_project_id_created_at_idx"
  ON "raw_sessions"("project_id", "created_at" DESC);
CREATE INDEX "raw_messages_raw_session_id_created_at_idx"
  ON "raw_messages"("raw_session_id", "created_at" ASC);
CREATE INDEX "raw_messages_created_at_idx"
  ON "raw_messages"("created_at" DESC);
CREATE INDEX "staged_memories_import_id_created_at_idx"
  ON "staged_memories"("import_id", "created_at" DESC);
CREATE INDEX "staged_memories_workspace_id_created_at_idx"
  ON "staged_memories"("workspace_id", "created_at" DESC);
CREATE INDEX "audit_logs_workspace_id_created_at_idx"
  ON "audit_logs"("workspace_id", "created_at" DESC);
CREATE INDEX "audit_logs_action_created_at_idx"
  ON "audit_logs"("action", "created_at" DESC);

-- Optional full-text support
CREATE INDEX "memories_content_tsv_idx"
  ON "memories"
  USING GIN (to_tsvector('simple', coalesce("content", '')));
CREATE INDEX "raw_messages_content_tsv_idx"
  ON "raw_messages"
  USING GIN (to_tsvector('simple', coalesce("content", '')));

-- Foreign keys
ALTER TABLE "workspace_members"
  ADD CONSTRAINT "workspace_members_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_members"
  ADD CONSTRAINT "workspace_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_members"
  ADD CONSTRAINT "project_members_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_members"
  ADD CONSTRAINT "project_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "memories"
  ADD CONSTRAINT "memories_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "memories"
  ADD CONSTRAINT "memories_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_settings"
  ADD CONSTRAINT "workspace_settings_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_mappings"
  ADD CONSTRAINT "project_mappings_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_mappings"
  ADD CONSTRAINT "project_mappings_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "imports"
  ADD CONSTRAINT "imports_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "raw_sessions"
  ADD CONSTRAINT "raw_sessions_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "raw_sessions"
  ADD CONSTRAINT "raw_sessions_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "raw_sessions"
  ADD CONSTRAINT "raw_sessions_import_id_fkey"
  FOREIGN KEY ("import_id") REFERENCES "imports"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "raw_messages"
  ADD CONSTRAINT "raw_messages_raw_session_id_fkey"
  FOREIGN KEY ("raw_session_id") REFERENCES "raw_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staged_memories"
  ADD CONSTRAINT "staged_memories_import_id_fkey"
  FOREIGN KEY ("import_id") REFERENCES "imports"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staged_memories"
  ADD CONSTRAINT "staged_memories_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staged_memories"
  ADD CONSTRAINT "staged_memories_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
