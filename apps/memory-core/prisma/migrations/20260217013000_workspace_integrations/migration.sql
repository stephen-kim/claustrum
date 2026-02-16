-- Workspace integrations for external providers (Jira/Confluence/Linear/Notion)
CREATE TYPE "IntegrationProvider" AS ENUM ('notion', 'jira', 'confluence', 'linear');

CREATE TABLE "workspace_integrations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_integrations_workspace_id_provider_key"
  ON "workspace_integrations"("workspace_id", "provider");

CREATE INDEX "workspace_integrations_workspace_id_provider_is_enabled_idx"
  ON "workspace_integrations"("workspace_id", "provider", "is_enabled");

ALTER TABLE "workspace_integrations"
  ADD CONSTRAINT "workspace_integrations_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
