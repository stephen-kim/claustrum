CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectRole') THEN
    CREATE TYPE "ProjectRole_next" AS ENUM (
      'OWNER',
      'MAINTAINER',
      'WRITER',
      'READER',
      'ADMIN',
      'MEMBER'
    );

    ALTER TABLE "project_members"
      ALTER COLUMN "role" DROP DEFAULT;

    ALTER TABLE "project_members"
      ALTER COLUMN "role" TYPE "ProjectRole_next"
      USING (
        CASE "role"::text
          WHEN 'ADMIN' THEN 'OWNER'
          WHEN 'MEMBER' THEN 'WRITER'
          ELSE "role"::text
        END
      )::"ProjectRole_next";

    DROP TYPE "ProjectRole";
    ALTER TYPE "ProjectRole_next" RENAME TO "ProjectRole";

    ALTER TABLE "project_members"
      ALTER COLUMN "role" SET DEFAULT 'READER';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "RawAccessMinRole" AS ENUM ('OWNER', 'MAINTAINER', 'WRITER', 'READER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workspace_settings"
  ADD COLUMN IF NOT EXISTS "raw_access_min_role" "RawAccessMinRole" NOT NULL DEFAULT 'WRITER';

ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "key_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMPTZ;

UPDATE "api_keys"
SET "key_hash" = encode(digest(COALESCE("key", "id"), 'sha256'), 'hex')
WHERE "key_hash" IS NULL;

ALTER TABLE "api_keys"
  ALTER COLUMN "key_hash" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_hash_key" ON "api_keys"("key_hash");
CREATE INDEX IF NOT EXISTS "api_keys_last_used_at_idx" ON "api_keys"("last_used_at");

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "project_id" TEXT;

DO $$
BEGIN
  ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "audit_logs_project_id_created_at_idx"
  ON "audit_logs"("project_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "workspace_members_workspace_id_user_id_idx"
  ON "workspace_members"("workspace_id", "user_id");

CREATE INDEX IF NOT EXISTS "project_members_project_id_user_id_idx"
  ON "project_members"("project_id", "user_id");
