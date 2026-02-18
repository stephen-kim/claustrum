# Claustrum Wiki Home


## Overview

Claustrum is a team-scalable Memory Core system for MCP clients.

Components:
- `memory-core`: REST API + Postgres data layer
- `mcp-adapter`: stdio MCP adapter that calls memory-core
- `admin-ui`: operations dashboard

Core principles:
- MCP safety: `stdout` JSON-RPC only, logs on `stderr`
- Default recall: curated `memories` only
- Optional raw search: snippet-only with audit logs


## Read Next

- [Recent Updates](recent-updates)
- [Installation](Installation)
- [Environment Variables (Full Reference)](Environment-Variables)
- [Dependency Management](dependency-management)
- [CI](ci)
- [Release Gate](release-gate)
- [Operations](Operations)
- [Security and MCP I/O](Security-and-MCP-IO)
- [OIDC SSO](OIDC-SSO)
- [Group Mapping](Group-Mapping)
- [Notion Integration](Notion-Integration)
- [Atlassian Integration](Atlassian-Integration)
- [Linear Integration](Linear-Integration)
- [GitHub Integration](GitHub-Integration)
- [GitHub Auto Projects](github-auto-projects)
- [GitHub Permission Sync](github-permission-sync)
- [GitHub Permission Calculation](github-permission-calculation)
- [GitHub Webhooks](github-webhooks)
- [GitHub Partial Recompute](github-partial-recompute)
- [GitHub Team Mapping](github-team-mapping)
- [Monorepo Split Policy](monorepo-split-policy)
- [Slack Audit Integration](Slack-Audit)
- [Outbound Locales and Prompt Tuning](Outbound-Locales)
- [Persona](persona)
- [Active Work Stale / Auto-close](active-work-stale)
- [Active Work Timeline](active-work-timeline)
- [Context Debug](context-debug)
- [Context Bundle Eval](context-bundle-eval)
- [Release Notes](Release-Notes)
- [Installation (Korean)](Installation.ko)


## Important Recent Changes

- CI and local tests: `memory-core` unit tests now prebuild `@claustrum/shared` to prevent `ERR_MODULE_NOT_FOUND` on clean runners.
- PR quality checks: Context Bundle Eval now runs on PRs and updates a sticky comment with score, top failures, and budget warnings.
- Release safety: release-gate now validates bootstrap/login gating, isolation, RBAC, webhooks, and secret leakage in one flow.


## API Summary

- `GET /healthz`
- `POST /v1/resolve-project`
- `GET/POST /v1/workspaces`
- `GET/POST /v1/projects`
- `GET/POST /v1/memories`
- `GET/PUT /v1/workspace-settings`
- `GET /v1/auth/oidc/:workspace_key/start`
- `GET /v1/auth/oidc/:workspace_key/callback`
- `GET/PUT /v1/workspaces/:key/sso-settings`
- `GET/POST/PATCH /v1/oidc/providers`
- `GET/POST/PATCH/DELETE /v1/oidc/group-mappings`
- `GET/PUT /v1/integrations`
- `GET /v1/workspaces/:key/github/install-url`
- `GET /v1/auth/github/callback`
- `POST /v1/workspaces/:key/github/sync-repos`
- `GET /v1/workspaces/:key/github/repos`
- `GET /v1/workspaces/:key/github/installation`
- `GET/POST/DELETE /v1/workspaces/:key/github/user-links`
- `POST /v1/workspaces/:key/github/sync-permissions`
- `GET /v1/workspaces/:key/github/permission-status`
- `GET /v1/workspaces/:key/github/permission-preview`
- `GET /v1/workspaces/:key/github/cache-status`
- `POST /v1/webhooks/github`
- `GET /v1/workspaces/:key/github/webhook-events`
- `GET/POST/PATCH/DELETE /v1/workspaces/:key/github/team-mappings`
- `GET/POST/PATCH /v1/project-mappings`
- `GET/POST /v1/users`
- `GET/POST /v1/project-members`
- `GET/POST /v1/imports`
- `POST /v1/imports/:id/parse`
- `POST /v1/imports/:id/extract`
- `GET /v1/imports/:id/staged`
- `POST /v1/imports/:id/commit`
- `GET /v1/raw/search`
- `GET /v1/raw/messages/:id`
- `GET /v1/audit-logs`
- `POST /v1/raw-events`
- `GET /v1/raw-events`
- `POST /v1/git-events`
- `POST /v1/ci-events`
- `GET/PUT /v1/workspaces/:key/outbound-settings`
- `GET/PUT /v1/outbound-policies/:integration_type`
- `POST /v1/outbound/render`
- `GET /v1/jira/search`
- `GET /v1/jira/read`
- `GET /v1/confluence/search`
- `GET /v1/confluence/read`
- `GET /v1/linear/search`
- `GET /v1/linear/read`


## Decision Auto Extraction

Raw git events can be converted into `decision` memories automatically.

- Input: `raw_events` (`post_commit`, `post_merge`, optional `post_checkout`)
- Output defaults:
  - `source=auto`
  - `status=draft`
  - `confidence` (rule-based)
  - `evidence` (`raw_event_ids`, `commit_sha`, changed files)

`auto_confirm` is optional and controlled by workspace policy.


## Draft / Confirmed Flow

`memories.status` supports:

- `draft`
- `confirmed`
- `rejected`

Admin UI can filter by status/source/confidence and move draft decisions to confirmed/rejected.


## Hybrid Search (FTS + pgvector)

`GET /v1/memories` supports `mode=keyword|semantic|hybrid`.

- `keyword`: PostgreSQL FTS (`content_tsv`, `ts_rank_cd`)
- `semantic`: pgvector cosine similarity (`embedding`)
- `hybrid` (default): weighted score merge
  - `alpha` (vector weight)
  - `beta` (FTS weight)

Workspace settings configure defaults:

- `search_default_mode`
- `search_hybrid_alpha`
- `search_hybrid_beta`
- `search_default_limit`
