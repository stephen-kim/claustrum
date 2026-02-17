DO $$
BEGIN
  CREATE TYPE "MemoryStatus" AS ENUM ('draft', 'confirmed', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MemorySource" AS ENUM ('auto', 'human', 'import');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AutoExtractionMode" AS ENUM ('draft_only', 'auto_confirm');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SearchDefaultMode" AS ENUM ('hybrid', 'keyword', 'semantic');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "memories"
  ADD COLUMN IF NOT EXISTS "status" "MemoryStatus" NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "source" "MemorySource" NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS "evidence" JSONB,
  ADD COLUMN IF NOT EXISTS "embedding" vector(256),
  ADD COLUMN IF NOT EXISTS "content_tsv" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce("content", ''))) STORED;

CREATE INDEX IF NOT EXISTS "memories_project_id_created_at_idx"
  ON "memories"("project_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "memories_content_tsv_idx"
  ON "memories" USING GIN ("content_tsv");
CREATE INDEX IF NOT EXISTS "memories_embedding_cosine_idx"
  ON "memories" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

ALTER TABLE "workspace_settings"
  ADD COLUMN IF NOT EXISTS "enable_auto_extraction" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "auto_extraction_mode" "AutoExtractionMode" NOT NULL DEFAULT 'draft_only',
  ADD COLUMN IF NOT EXISTS "auto_confirm_min_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
  ADD COLUMN IF NOT EXISTS "auto_confirm_allowed_event_types" JSONB NOT NULL DEFAULT '["post_commit", "post_merge"]'::jsonb,
  ADD COLUMN IF NOT EXISTS "auto_confirm_keyword_allowlist" JSONB NOT NULL DEFAULT '["migrate", "switch", "remove", "deprecate", "rename", "refactor"]'::jsonb,
  ADD COLUMN IF NOT EXISTS "auto_confirm_keyword_denylist" JSONB NOT NULL DEFAULT '["wip", "tmp", "debug", "test", "try"]'::jsonb,
  ADD COLUMN IF NOT EXISTS "auto_extraction_batch_size" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "search_default_mode" "SearchDefaultMode" NOT NULL DEFAULT 'hybrid',
  ADD COLUMN IF NOT EXISTS "search_hybrid_alpha" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
  ADD COLUMN IF NOT EXISTS "search_hybrid_beta" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
  ADD COLUMN IF NOT EXISTS "search_default_limit" INTEGER NOT NULL DEFAULT 20;
