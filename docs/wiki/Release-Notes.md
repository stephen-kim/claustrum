# Release Notes


## 2026-02-16


### Monorepo Expansion

- Added pnpm workspace layout:
  - `apps/memory-core`
  - `apps/mcp-adapter`
  - `apps/admin-ui`
  - `packages/shared`
- Added team-ready Memory Core backend with Prisma/Postgres (REST-first):
  - multi-tenant models (`workspaces`, `users`, `workspace_members`, `projects`, `project_members`, `memories`, `api_keys`)
  - REST API for projects/members/memories/workspaces/users
- Added MCP stdio thin adapter (`apps/mcp-adapter`) that proxies to memory-core REST:
  - tools: `set_workspace`, `set_project`, `remember`, `recall`, `list_projects`, `search_raw`
- Added idempotent seed flow for local bootstrap (`personal` workspace + admin user + default project + admin key).
- Added Next.js Admin UI for workspace/user/project/member management and memory search/detail.
- Added monorepo Docker setup (`postgres`, `memory-core`, `mcp-adapter`, `admin-ui`) with root `docker-compose.yml`.
- Added REST smoke test script for memory-core:
  - workspace/project create
  - memory create/query
  - resolver flow
  - raw import/search/audit flow
- Added project resolver model and API:
  - `workspace_settings` (resolution order, auto-create policy, key prefixes)
  - `project_mappings` (github_remote/repo_root_slug/manual selectors)
  - `POST /v1/resolve-project`, `GET/PUT /v1/workspace-settings`, `GET/POST/PATCH /v1/project-mappings`
- Added raw import and snippet-search model:
  - `imports`, `raw_sessions`, `raw_messages`, `staged_memories`, `audit_logs`
  - `POST /v1/imports`, parse/extract/commit endpoints
  - `GET /v1/raw/search`, `GET /v1/raw/messages/:id`
  - audit events `raw.search`, `raw.view`


### Highlights

- Replaced SQLite runtime storage with PostgreSQL.
- Added reproducible migration command: `pnpm db:migrate`.
- Added key-based project APIs and resolver-driven project selection.
- Added `project_key` override for `remember`/`recall`.
- Added controlled raw search (snippet-only, max chars, audit logs).
- Added Docker assets and external DB support.
- Added `audit_reasoner` integration for asynchronous AI-generated audit reasons.
  - Provider: OpenAI or Gemini
  - Priority: `ENV > Admin UI` workspace setting


### MCP Compatibility

- Server runtime keeps stdout reserved for JSON-RPC protocol messages only.
- Operational logs and diagnostics are emitted to stderr.
