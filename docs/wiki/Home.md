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

- [Installation](Installation)
- [Operations](Operations)
- [Security and MCP I/O](Security-and-MCP-IO)
- [Notion Integration](Notion-Integration)
- [Atlassian Integration](Atlassian-Integration)
- [Linear Integration](Linear-Integration)
- [Slack Audit Integration](Slack-Audit)
- [Release Notes](Release-Notes)
- [Installation (Korean)](Installation.ko)


## API Summary

- `GET /healthz`
- `POST /v1/resolve-project`
- `GET/POST /v1/workspaces`
- `GET/POST /v1/projects`
- `GET/POST /v1/memories`
- `GET/PUT /v1/workspace-settings`
- `GET/PUT /v1/integrations`
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
