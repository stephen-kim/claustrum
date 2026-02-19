CREATE TABLE IF NOT EXISTS "llm_pricing" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "input_token_price_per_1k_cents" double precision NOT NULL,
  "output_token_price_per_1k_cents" double precision NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "llm_pricing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "llm_pricing_provider_model_key"
  ON "llm_pricing"("provider", "model");

CREATE INDEX IF NOT EXISTS "llm_pricing_provider_is_active_idx"
  ON "llm_pricing"("provider", "is_active");

CREATE TABLE IF NOT EXISTS "llm_usage_events" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" text NOT NULL,
  "project_id" text,
  "actor_user_id" text,
  "system_actor" text,
  "purpose" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "input_tokens" integer,
  "output_tokens" integer,
  "estimated_cost_cents" double precision,
  "correlation_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "llm_usage_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "llm_usage_events_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "llm_usage_events_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "llm_usage_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "llm_usage_events_workspace_id_created_at_idx"
  ON "llm_usage_events"("workspace_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "llm_usage_events_workspace_id_purpose_created_at_idx"
  ON "llm_usage_events"("workspace_id", "purpose", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "llm_usage_events_workspace_id_provider_model_created_at_idx"
  ON "llm_usage_events"("workspace_id", "provider", "model", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "llm_usage_events_workspace_id_correlation_id_idx"
  ON "llm_usage_events"("workspace_id", "correlation_id");
