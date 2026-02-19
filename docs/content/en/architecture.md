# Claustrum Architecture


## High-Level Topology

```mermaid
flowchart LR
  subgraph Clients["AI Clients"]
    Codex["Codex"]
    Claude["Claude"]
    IDE["IDE / Agent Runtime"]
  end

  MCP["MCP Adapter\n(stdio JSON-RPC)"]
  Core["Memory Core\n(REST API)"]
  DB[("Postgres")]
  UI["Admin UI"]
  Git["Git Events / CI Events"]
  Import["Import Pipeline\n(Codex/Claude/Generic)"]

  Codex --> MCP
  Claude --> MCP
  IDE --> MCP
  MCP -->|HTTP| Core
  UI -->|HTTP| Core
  Git -->|/v1/git-events / /v1/ci-events| Core
  Import -->|/v1/imports*| Core
  Core --> DB
```


## Data Model (Simplified ERD)

```mermaid
erDiagram
  workspaces ||--o{ projects : contains
  workspaces ||--o{ workspace_members : has
  users ||--o{ workspace_members : joins

  projects ||--o{ project_members : has
  users ||--o{ project_members : joins

  workspaces ||--o{ memories : stores
  projects ||--o{ memories : scopes
  users ||--o{ memories : creates

  workspaces ||--o{ raw_sessions : stores
  projects ||--o{ raw_sessions : optional_scope
  raw_sessions ||--o{ raw_messages : contains

  workspaces ||--o{ audit_logs : records
  users ||--o{ audit_logs : acts
```


## Project Resolution

Resolver order:

1. `github_remote`
2. `repo_root_slug`
3. `manual`

Monorepo subproject format:

- `github:owner/repo`
- `github:owner/repo#apps/memory-core`

Subproject detection is path-based and policy-controlled via `workspace_settings`.


## Auto Switch and Pin Mode

- `ensureContext()` runs before `remember`, `recall`, `search_raw`.
- Repo switch can auto-transition by policy (`auto_switch_repo`).
- Subproject switch can be independently toggled (`auto_switch_subproject`).
- Manual pin mode (`set_project`) disables auto switching until `unset_project_pin()`.


## Raw Import and Raw Search Guardrails

- Raw import pipeline: upload -> parse -> extract -> commit.
- Default recall path remains `memories` only.
- Raw search returns snippet-only responses with max length limits.
- Raw access actions are recorded in `audit_logs`.
