# Installation

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+ (local container or external DB)
- Docker / Docker Compose (recommended for local bootstrap)

## Environment Variables

Application DB rule:
- `memory-core` uses `DATABASE_URL` only.
- `POSTGRES_*` are local compose postgres bootstrap vars only.

Key variables:
- `DATABASE_URL`
- `MEMORY_CORE_API_KEY` or `MEMORY_CORE_API_KEYS`
- `MEMORY_CORE_SEED_ADMIN_KEY`
- `MEMORY_CORE_URL`
- `MEMORY_CORE_WORKSPACE_KEY`
- `NEXT_PUBLIC_MEMORY_CORE_URL`

### API Key Variables (Important)

- `MEMORY_CORE_API_KEY`
  - Runtime bearer token used by clients (mcp-adapter/admin scripts) to call memory-core.
  - If this key is present in env, memory-core treats it as an env-admin key.
- `MEMORY_CORE_SEED_ADMIN_KEY`
  - Used only during `pnpm db:seed` to create/update (`upsert`) one admin key row in DB table `api_keys`.
  - If omitted, seed falls back to `MEMORY_CORE_API_KEY`.

Upsert means:
- insert when key does not exist
- update when key already exists
- so repeated `db:seed` runs are safe (idempotent)

Recommended setup:
- Local/dev: set both to the same strong value.
- Production: use `MEMORY_CORE_API_KEY` for runtime, and run `db:seed` with a controlled `MEMORY_CORE_SEED_ADMIN_KEY` only when needed.

## Compose Files

- `docker-compose.yml`: image-based deployment (Dockge/server)
- `docker-compose.dev.yml`: source-build local development
- Required for image-based compose: `MEMORY_CORE_IMAGE`, `MCP_ADAPTER_IMAGE`, `ADMIN_UI_IMAGE`

## Local Development (source-build containers)

```bash
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yml --profile localdb up -d --build
```

Local endpoints:
- memory-core: `http://localhost:8080`
- admin-ui: `http://localhost:3000`

## Local Development (local processes + DB container)

```bash
pnpm install
cp .env.example .env
docker compose --profile localdb up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## External DB (RDS, Cloud Postgres, etc.)

1. Copy env file:

```bash
cp .env.example .env
```

2. Set external DB URL:

```bash
DATABASE_URL=postgres://<user>:<pass>@<rds-endpoint>:5432/<db>?sslmode=require
```

3. Start services (no localdb profile):

```bash
docker compose up -d
```

## Docker Notes

- In containers, do not use `localhost` for inter-service calls.
- Use compose service names (`memory-core`, `postgres`).
- Browser-facing URL (`NEXT_PUBLIC_MEMORY_CORE_URL`) should be `localhost` or your domain.

## Codex MCP Adapter Setup

`~/.codex/config.toml`

```toml
[mcp_servers.memory-core]
command = "pnpm"
args = ["--filter", "@context-sync/mcp-adapter", "start"]

[mcp_servers.memory-core.env]
MEMORY_CORE_URL = "http://127.0.0.1:8080"
MEMORY_CORE_API_KEY = "<strong-runtime-key>"
MEMORY_CORE_WORKSPACE_KEY = "personal"
MCP_ADAPTER_LOG_LEVEL = "error"
```
