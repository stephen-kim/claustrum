-- Phase 1 API-key hardening:
-- - workspace scoped keys
-- - device label required
-- - key prefix metadata
-- - optional expiry

INSERT INTO "workspaces" ("id", "key", "name", "created_at", "updated_at")
SELECT 'bootstrap', 'bootstrap', 'Bootstrap Workspace', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "workspaces");

ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "workspace_id" text,
  ADD COLUMN IF NOT EXISTS "key_prefix" text,
  ADD COLUMN IF NOT EXISTS "device_label" text,
  ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;

UPDATE "api_keys" ak
SET "workspace_id" = COALESCE(
  (
    SELECT wm."workspace_id"
    FROM "workspace_members" wm
    WHERE wm."user_id" = ak."user_id"
    ORDER BY wm."created_at" ASC
    LIMIT 1
  ),
  (
    SELECT w."id"
    FROM "workspaces" w
    ORDER BY w."created_at" ASC
    LIMIT 1
  ),
  'bootstrap'
)
WHERE ak."workspace_id" IS NULL;

UPDATE "api_keys"
SET "key_prefix" = COALESCE(
  "key_prefix",
  CASE
    WHEN "key" IS NOT NULL THEN left("key", 10) || '****' || right("key", 4)
    ELSE 'hash_' || left("key_hash", 6) || '****' || right("key_hash", 4)
  END
)
WHERE "key_prefix" IS NULL;

UPDATE "api_keys"
SET "device_label" = COALESCE(NULLIF(trim("device_label"), ''), 'unknown-device')
WHERE "device_label" IS NULL OR trim("device_label") = '';

ALTER TABLE "api_keys"
  ALTER COLUMN "workspace_id" SET NOT NULL,
  ALTER COLUMN "key_prefix" SET NOT NULL,
  ALTER COLUMN "device_label" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'api_keys_workspace_id_fkey'
  ) THEN
    ALTER TABLE "api_keys"
      ADD CONSTRAINT "api_keys_workspace_id_fkey"
      FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "api_keys_workspace_id_idx" ON "api_keys"("workspace_id");
CREATE INDEX IF NOT EXISTS "api_keys_workspace_id_user_id_idx" ON "api_keys"("workspace_id", "user_id");
