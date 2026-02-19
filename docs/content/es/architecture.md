# Arquitectura de Claustrum

## Topología general

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

## Modelo de datos (ERD simplificado)

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

## Resolución de proyecto

Orden del resolver:

1. `github_remote`
2. `repo_root_slug`
3. `manual`

Formato de key en monorepo:

- `github:owner/repo`
- `github:owner/repo#apps/memory-core`

La detección de subproyecto es por ruta y se controla en `workspace_settings`.

## Auto-switch y modo pin

- `ensureContext()` corre antes de `remember`, `recall` y `search_raw`.
- El cambio automático de repo depende de `auto_switch_repo`.
- El cambio automático de subproyecto depende de `auto_switch_subproject`.
- `set_project` activa pin mode y se mantiene hasta `unset_project_pin()`.

## Protecciones para import y búsqueda raw

- Flujo raw import: upload -> parse -> extract -> commit.
- El recall por defecto sigue usando `memories`.
- Raw search devuelve solo snippets con límite de longitud.
- Todo acceso raw queda registrado en `audit_logs`.
