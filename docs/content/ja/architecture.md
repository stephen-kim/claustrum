# Claustrum アーキテクチャ

## 全体トポロジー

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

## データモデル（簡略 ERD）

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

## プロジェクト解決（Resolver）

優先順:

1. `github_remote`
2. `repo_root_slug`
3. `manual`

モノレポのキー形式:

- `github:owner/repo`
- `github:owner/repo#apps/memory-core`

サブプロジェクト検出はパスベースで、`workspace_settings` のポリシーで制御されます。

## Auto Switch と Pin モード

- `ensureContext()` は `remember` / `recall` / `search_raw` の前に実行
- リポジトリ切り替えは `auto_switch_repo` で制御
- サブプロジェクト切り替えは `auto_switch_subproject` で個別制御
- `set_project` で pin mode に入り、`unset_project_pin()` まで固定

## Raw インポートと検索のガードレール

- raw import フロー: upload -> parse -> extract -> commit
- 既定の recall は `memories` 中心
- raw search は snippet のみ返却（長さ上限あり）
- raw アクセスは必ず `audit_logs` に記録
