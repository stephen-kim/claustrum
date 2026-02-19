# Claustrum

![Claustrum Banner](./.github/assets/banner.png)

[English README](README.md) | [한국어 README](README.ko.md) | [日本語 README](README.ja.md) | [Español README](README.es.md) | [中文 README](README.zh.md)

Claustrum is a shared memory layer for AI systems. It integrates context across projects, tools, and teams.


## What This Project Does

- Shares memory context across multiple computers and developers.
- Keeps MCP workflows production-safe (`stdout` clean, policy-driven behavior).
- Provides team operations via Admin UI (workspace/project/user/permissions/audit).
- Supports external context sources (Notion, Jira, Confluence, Linear, Slack).


## Why This Exists

AI coding context often gets fragmented:

- each machine has different memory state
- each teammate sees different context
- project decisions are lost in commits/chats/docs

Claustrum turns that into a shared, queryable memory system for teams.


## Core Components

- **Memory Core**: REST API + policy + Postgres storage.
- **MCP Adapter**: stdio MCP bridge to Memory Core.
- **Admin UI**: management dashboard for teams.
- **Shared Package**: schemas/types/utilities used across apps.


## Documentation (Pages-first)

This README is intentionally short. Detailed setup/config/operations are published on GitHub Pages and sourced from `docs/content`.

- [Docs Site (GitHub Pages)](https://stephen-kim.github.io/claustrum/)
- One-line MCP config helper:
  `curl -fsSL https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -o ./claustrum-mcp-config-helper.js && node ./claustrum-mcp-config-helper.js`


## Repository Layout

```text
apps/
  docs-site/
  memory-core/
  mcp-adapter/
  admin-ui/
packages/
  shared/
```text


## Upstream

- Upstream (`upstream`): `https://github.com/Intina47/context-sync.git`
