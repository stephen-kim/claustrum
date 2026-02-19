# Repository Guidelines


## Project Structure & Module Organization

- This repository is a **pnpm workspace monorepo**.
- Main folders:
  - `apps/memory-core`: REST API server (Express + Prisma + Postgres).
  - `apps/mcp-adapter`: MCP stdio adapter that calls memory-core over HTTP.
  - `apps/admin-ui`: Next.js App Router admin dashboard.
  - `packages/shared`: shared Zod schemas/types used by multiple apps.
- MCP server/runtime implementation lives in `apps/mcp-adapter`.
- Root legacy `src/` and setup CLI `bin/` were removed; treat root as workspace orchestrator.


## Build, Test, and Development Commands

- Workspace-level (recommended):
  - `pnpm install`
  - `pnpm db:migrate`
  - `pnpm db:seed`
  - `pnpm dev` (runs shared + memory-core + mcp-adapter + admin-ui)
  - `pnpm test:workspace`
- Per-app:
  - `pnpm --filter @claustrum/memory-core build|dev|test`
  - `pnpm --filter @claustrum/mcp-adapter build|dev|test`
  - `pnpm --filter @claustrum/admin-ui build|dev|test`
  - `pnpm --filter @claustrum/shared build|dev|test`
- Docker:
  - image-based deploy (default): `docker compose up -d`
  - image-based local DB: `docker compose --profile localdb up -d`
  - source-build local dev: `docker compose -f docker-compose.dev.yml --profile localdb up -d`
  - down: `docker compose down` (or `docker compose -f docker-compose.dev.yml down`)


## Environment & Configuration Rules

- `memory-core` uses `DATABASE_URL` for DB connection.
- `POSTGRES_*` variables are for local compose postgres bootstrap only.
- Required for adapter:
  - `MEMORY_CORE_URL`
  - `MEMORY_CORE_API_KEY`
- Required for admin-ui:
  - `NEXT_PUBLIC_MEMORY_CORE_URL`
- For external Postgres/RDS, SSL options must be included in `DATABASE_URL` query (e.g. `sslmode=require`).


## MCP / Logging Safety (Critical)

- MCP stdio servers must keep protocol-safe IO:
  - `stdout`: JSON-RPC only.
  - `stderr`: logs/errors only.
- Do not print banners, migration logs, or debug text to stdout in `apps/mcp-adapter`.
- If adding logs, route them through existing logger utilities (stderr-based).


## Coding Style & Naming Conventions

- Language: TypeScript (ES modules), strict typing preferred.
- Indentation: 2 spaces.
- Keep modules focused and small; avoid cross-app leakage.
- Use descriptive names; avoid single-letter variables except local loop counters.
- Respect existing file naming in each app:
  - backend modules: kebab-case files in `src/`
  - Next.js app files follow framework conventions (`app/page.tsx`, `app/layout.tsx`).


## Database & Migration Guidelines

- Prisma schema location: `apps/memory-core/prisma/schema.prisma`.
- SQL migrations: `apps/memory-core/prisma/migrations/*`.
- Schema changes must include:
  - Prisma model updates
  - migration SQL updates
  - seed/test compatibility checks
- Prefer idempotent seed behavior (`upsert` patterns).


## Testing Guidelines

- Add/maintain tests close to feature area:
  - `apps/mcp-adapter/src/*.test.ts` for adapter utilities.
  - `apps/memory-core/scripts/rest-smoke-test.mjs` for end-to-end API smoke flows.
- Note: memory-core smoke test requires `DATABASE_URL`.
- For raw import/search features, verify:
  - import -> parse -> extract -> commit flow
  - snippet max length enforcement
  - audit log creation (`raw.search`, `raw.view`)


## Commit & Pull Request Guidelines

- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `perf:`, `docs:`, `chore:`.
- Keep PRs focused and include:
  - what changed
  - why it changed
  - migration/env impacts
  - API/UX changes (with screenshots for admin-ui when relevant)


## Documentation Update Policy

- If behavior changes, update docs in the same PR:
  - root `README.md` for architecture/setup/API-level changes
  - `docs/` files for legacy package behavior if touched
- If env vars or startup flow change, update:
  - `.env.example`
  - compose examples
  - Codex MCP config examples when needed
