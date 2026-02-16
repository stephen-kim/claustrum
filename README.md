# context-sync: Team-Scalable Memory Core

[English](README.md) | [한국어](README.ko.md)

Production-grade memory infrastructure for AI coding agents.

`context-sync` is built for teams running Codex/Claude-style MCP workflows in real projects, not demos.

## Why It Hits Different

- **MCP-safe by design**: strict stdio discipline (`stdout` JSON-RPC only, logs to `stderr`).
- **Team-ready model**: workspaces, projects, members, permissions, and audit logs.
- **Reliable recall behavior**: default recall is **memories-first** (clean, curated context).
- **Controlled raw access**: optional raw search is snippet-only with hard caps and audit trails.
- **Operational audit visibility**: audit events can be forwarded to Slack with who/what/why context.
- **External docs context**: optional Notion/Jira/Confluence/Linear read/search integrations for team knowledge reuse.
  - Notion/Jira/Confluence/Linear credentials can be stored per workspace from Admin UI (`/v1/integrations`), not only env vars.
- **Production deployment path**: Postgres, migrations/seeds, Docker Compose, external DB support.

## Monorepo Apps

- `apps/memory-core`: REST API server (Express + Prisma + Postgres)
- `apps/mcp-adapter`: MCP stdio adapter that calls memory-core over HTTP
- `apps/admin-ui`: Next.js admin dashboard
- `packages/shared`: shared schemas/types

## Compose Modes

- `docker-compose.yml`: image-based deployment (recommended for Dockge/servers)
- `docker-compose.dev.yml`: source-build local development

If you publish/use your own images, override:
- `MEMORY_CORE_IMAGE`
- `MCP_ADAPTER_IMAGE`
- `ADMIN_UI_IMAGE`

## Quick Start (Local Dev, Source-Build Containers)

```bash
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yml --profile localdb up -d --build
```

## Quick Start (Local Processes + DB Container)

```bash
pnpm install
cp .env.example .env
docker compose --profile localdb up -d postgres
pnpm db:migrate && pnpm db:seed
pnpm dev
```

## Auth Keys (Runtime vs Seed)

- `MEMORY_CORE_API_KEY`
  - Runtime bearer token used by `mcp-adapter` / admin scripts to call `memory-core`.
  - If configured in env, `memory-core` accepts it as an env-admin key.
- `MEMORY_CORE_SEED_ADMIN_KEY`
  - Used only by `pnpm db:seed` to create/update (`upsert`) an admin key row in DB table `api_keys`.
  - If omitted, seed falls back to `MEMORY_CORE_API_KEY`.

Recommended:
- local/dev: set both to the same strong key
- production: separate runtime key and seed key lifecycle

## Slack Audit Alerts (Who / What / Why)

Set these in `.env` to mirror audit events into Slack:

```bash
MEMORY_CORE_AUDIT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
MEMORY_CORE_AUDIT_SLACK_ACTION_PREFIXES=workspace_settings.,project_mapping.,integration.
```

Admin UI now sends `reason` on:
- Resolution settings save
- Project mapping add/update
- Integration save

Slack messages include action, workspace, actor, changed fields, and reason.

Admin UI can now override Slack audit behavior per workspace via `Integrations -> Slack Audit`:
- action prefix filters
- format (`detailed` / `compact`)
- masking + target JSON include flags
- severity rules (`action_prefix -> severity`)
- routing rules (`action_prefix -> channel, min_severity`)

Example JSON:
```json
{
  "routes": [
    { "action_prefix": "git.", "channel": "#audit-devflow", "min_severity": "medium" },
    { "action_prefix": "integration.", "channel": "#audit-security", "min_severity": "high" }
  ],
  "severity_rules": [
    { "action_prefix": "integration.", "severity": "high" },
    { "action_prefix": "raw.", "severity": "low" }
  ]
}
```

Integration precedence policy:
- Default: workspace config from Admin UI wins, env values are fallback.
- Optional lock: set `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=notion,jira,confluence,linear,slack` (subset allowed) to force env-only mode for listed providers.
- Locked providers appear as read-only in Admin UI and updates are rejected server-side.

## Git Hook Audit + Auto Write

- In Admin UI Integrations, enable per-provider checkboxes:
  - `auto write on commit hook`
  - `auto write on merge hook`
- Install git hooks from context-sync tool with:
  - `set_project({ key: "...", enable_git_hooks: true })`
- Git hook events (`post-commit`, `post-merge`) are forwarded to `memory-core /v1/git-events`.
- `memory-core` records `git.commit` / `git.merge` audit logs and forwards them to Slack if configured.
- Notion: when hook auto-write is enabled, memory-core attempts automatic Notion write on those events.
- Jira/Confluence/Linear: hook trigger + audit path is supported now; provider-side write can be added incrementally.

## External DB (RDS, etc.)

```bash
cp .env.example .env
# set DATABASE_URL to external Postgres (example includes sslmode=require)
docker compose up -d
```

## Dockge (Image-Based)

```bash
cp .env.example .env
# set DATABASE_URL + MEMORY_CORE_API_KEY + MEMORY_CORE_SEED_ADMIN_KEY
# set MEMORY_CORE_IMAGE / MCP_ADAPTER_IMAGE / ADMIN_UI_IMAGE to published tags
docker compose up -d
```

## Publish Image Tags (GHCR)

This repository includes `.github/workflows/docker-publish.yml`.

- Trigger:
  - push to `main` -> publish `latest` + `sha-<short>` tags
  - push tag `v*` -> publish version tag (e.g. `v0.1.0`)
- Images:
  - `ghcr.io/<owner>/context-sync-memory-core:<tag>`
  - `ghcr.io/<owner>/context-sync-mcp-adapter:<tag>`
  - `ghcr.io/<owner>/context-sync-admin-ui:<tag>`

Release example:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Docs / Wiki

Detailed installation and operations guides are maintained in Wiki-style docs:

- Wiki Home (GitHub): <https://github.com/stephen-kim/context-sync/wiki>
- Local source docs for wiki pages:
  - `docs/wiki/Home.md`
  - `docs/wiki/Installation.md`
  - `docs/wiki/Operations.md`
  - `docs/wiki/Security-and-MCP-IO.md`
- `docs/wiki/Notion-Integration.md`
  - Includes `notion_context` MCP bootstrap flow (`search -> read snippets`)
- `docs/wiki/Atlassian-Integration.md`
  - Jira issue context + Confluence docs context (search/read + audit)
- `docs/wiki/Linear-Integration.md`
  - Linear issue context (search/read + audit)

## Codex MCP Config Example

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

## Fork Information

Current git remotes:
- Fork (`origin`): `https://github.com/stephen-kim/context-sync.git`
- Upstream (`upstream`): `https://github.com/Intina47/context-sync.git`
