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

Full reference:
- [Environment Variables (Full Reference)](Environment-Variables)

Minimal variables for first boot:
- `DATABASE_URL`
- `MEMORY_CORE_API_KEY`
- `MEMORY_CORE_URL`
- `NEXT_PUBLIC_MEMORY_CORE_URL`
- (`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`) for localdb profile only

Optional but recommended:
- `MEMORY_CORE_SECRET` (single shared secret used as fallback for session/hash/one-time/GitHub-state secrets)


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
- so repeated `db:seed` runs are safe to run multiple times

Recommended setup:
- Local/dev: set both to the same strong value.
- Production: use `MEMORY_CORE_API_KEY` for runtime, and run `db:seed` with a controlled `MEMORY_CORE_SEED_ADMIN_KEY` only when needed.


## Compose Files

- `docker-compose.yml`: image-based deployment (Dockge/server)
- `docker-compose.dev.yml`: source-build local development
- Optional image overrides: `MEMORY_CORE_IMAGE`, `MCP_ADAPTER_IMAGE`, `ADMIN_UI_IMAGE`
- Default images:
  - `ghcr.io/stephen-kim/claustrum-memory-core:latest`
  - `ghcr.io/stephen-kim/claustrum-mcp-adapter:latest`
  - `ghcr.io/stephen-kim/claustrum-admin-ui:latest`


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
args = ["--filter", "@claustrum/mcp-adapter", "start"]

[mcp_servers.memory-core.env]
MEMORY_CORE_URL = "http://127.0.0.1:8080"
MEMORY_CORE_API_KEY = "<runtime-api-key>"
MEMORY_CORE_WORKSPACE_KEY = "personal"
MCP_ADAPTER_LOG_LEVEL = "error"
```


## Manual MCP Setup (No Setup CLI)

Claustrum no longer ships an automatic setup CLI.
Configure MCP clients directly with the adapter command.

Example (absolute path):

```toml
[mcp_servers.claustrum]
command = "node"
args = ["/absolute/path/to/claustrum/apps/mcp-adapter/dist/index.js"]

[mcp_servers.claustrum.env]
MEMORY_CORE_URL = "http://127.0.0.1:8080"
MEMORY_CORE_API_KEY = "<runtime-api-key>"
MEMORY_CORE_WORKSPACE_KEY = "personal"
MCP_ADAPTER_LOG_LEVEL = "error"
```

Notes:
- Build adapter once before using `dist` entry:
  - `pnpm --filter @claustrum/mcp-adapter build`
- `stdout` must stay JSON-RPC only (adapter logs go to `stderr`).


## MCP Config Helper (Optional)

Run the interactive wizard:

```bash
pnpm mcp:helper
```

Wizard features:
- multi-client selection (`Space` to toggle, arrow keys to navigate)
- supported clients: Codex, Claude Code, Cursor, Antigravity
- prompts for adapter command/args
- automatic backup of existing config files before write
- restart reminder after applying settings

One-line download + run (from anywhere):

```bash
curl -fsSL https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -o ./claustrum-mcp-config-helper.js && node ./claustrum-mcp-config-helper.js
```

Windows PowerShell:

```powershell
iwr https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -OutFile .\claustrum-mcp-config-helper.js; node .\claustrum-mcp-config-helper.js
```

Default adapter execution values:
- `command = "pnpm"`
- `args = ["--filter", "@claustrum/mcp-adapter", "start"]`

The helper writes command/args only.
Set `MEMORY_CORE_*` in the adapter runtime environment.

Useful options:
- `--profile <name>`: MCP profile key (default: `claustrum`)
- `--clients <csv>`: non-interactive target clients (e.g. `codex,cursor`)
- `--config <path>`: custom config path
- `--adapter-command <value>`
- `--adapter-args "<value>"`
- `--non-interactive --write --yes`: apply without wizard
