# Claustrum

Claustrum is a shared memory layer for AI systems. It integrates context across projects, tools, and teams.

Claustrum provides production-oriented memory infrastructure for MCP-driven AI development workflows.


## Core Components

- **Memory Core**: REST API, auth, policy, and Postgres-backed storage.
- **MCP Adapter**: stdio MCP server that calls Memory Core over HTTP (stdout JSON-RPC only).
- **Admin UI**: web dashboard for workspaces, projects, memories, imports, integrations, and audit logs.
- **Shared Package**: common schemas, types, and shared utilities.


## Monorepo Structure

```text
apps/
  memory-core/
  mcp-adapter/
  admin-ui/
packages/
  shared/
infra/
  docker-compose.yml
```

Infrastructure manifests are mirrored in `infra/docker-compose.yml`.
Primary runtime compose files remain at repository root (`docker-compose.yml`, `docker-compose.dev.yml`).


## Architecture

Detailed architecture and data model diagrams:

- `docs/architecture.md`


## Project Resolution and Memory Scope

Default resolution order:

1. `github_remote`
2. `repo_root_slug`
3. `manual`

Monorepo subproject keys are **path-based** (not `package.json` name-based):

- repo key: `github:owner/repo`
- subproject key: `github:owner/repo#apps/memory-core`

Auto-switch defaults:

- `auto_switch_repo=true`
- `auto_switch_subproject=false`
- `enable_monorepo_resolution=false`
- `monorepo_detection_level=2`

Pin mode tools:

- `set_project({ key })`
- `unset_project_pin()`
- `get_current_project()`


## Git Event Capture

Claustrum can capture git lifecycle events as raw operational signals:

- `post-commit` (default enabled)
- `post-merge` (default enabled)
- `post-checkout` (default disabled, optional)

Policy is controlled in **Admin UI > Project Resolution Settings > Git Events**:

- `enable_git_events`
- `enable_commit_events`
- `enable_merge_events`
- `enable_checkout_events`
- `checkout_debounce_seconds`
- `checkout_daily_limit`

Safety guarantees:

- No `pre-push` hook support (intentional).
- Hooks are fire-and-forget (`&`) and always `exit 0`.
- Hook failures never block git operations.
- Hook scripts redirect output (`>/dev/null 2>&1`) to avoid stdout/stderr noise during git commands.

APIs:

- `POST /v1/raw-events`
- `GET /v1/raw-events`
- `POST /v1/git-events` (legacy-compatible alias mapped to raw events)


## Quickstart (localdb)

```bash
cp .env.example .env
docker compose --profile localdb up -d
pnpm db:migrate && pnpm db:seed
```


## Quickstart (external DB)

1. Copy env template:

```bash
cp .env.example .env
```

2. Set external DB in `DATABASE_URL` (example RDS):

```bash
DATABASE_URL=postgres://<user>:<pass>@<rds-endpoint>:5432/<db>?sslmode=require
```

3. Start services (without localdb profile):

```bash
docker compose up -d
```


## Docker Networking Notes

- For localdb profile in containers, `DATABASE_URL` host should be `postgres` (service name), not `localhost`.
- `MEMORY_CORE_URL` is for container-to-container calls (typically `http://memory-core:8080`).
- `NEXT_PUBLIC_MEMORY_CORE_URL` must be browser-reachable (typically `http://localhost:8080` or a domain URL).


## Developer Workflow

```bash
pnpm install
pnpm build:workspace
pnpm test:workspace
pnpm dev
```


## Docs

- `docs/architecture.md`
- `docs/wiki/Home.md`
- `docs/wiki/Installation.md`
- `docs/wiki/Operations.md`
- `docs/wiki/Security-and-MCP-IO.md`


## Upstream

- Upstream (`upstream`): `https://github.com/Intina47/context-sync.git`
