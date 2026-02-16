# context-sync Wiki Home

## Overview

context-sync is a team-scalable Memory Core system for MCP clients.

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
- `GET /v1/jira/search`
- `GET /v1/jira/read`
- `GET /v1/confluence/search`
- `GET /v1/confluence/read`
- `GET /v1/linear/search`
- `GET /v1/linear/read`
