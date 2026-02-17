ALTER TABLE "workspace_settings"
  ADD COLUMN IF NOT EXISTS "auto_switch_repo" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "auto_switch_subproject" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "allow_manual_pin" BOOLEAN NOT NULL DEFAULT true;
