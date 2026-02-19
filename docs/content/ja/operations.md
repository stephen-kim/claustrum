# 運用ガイド

## データ/検索の基本方針

- 標準の `recall` は `memories` のみを対象にします。
- raw 原文データは標準検索経路から分離されています。
- raw 検索はスニペットのみ返却し、全文は返しません。

## Raw Import パイプライン

1. `POST /v1/imports`（アップロード）
2. `POST /v1/imports/:id/parse`
3. `POST /v1/imports/:id/extract`
4. `POST /v1/imports/:id/commit`

データフロー:

- `imports` → `raw_sessions/raw_messages` → `staged_memories` → `memories`

## プロジェクト解決（Resolver）

優先順位:

1. `github_remote`
2. `repo_root_slug`
3. `manual`

ワークスペース設定で調整可能:

- `resolution_order`
- `auto_create_project`
- key prefix
- `project_mappings`

## 自動スイッチ方針

`ensureContext()` は `remember`, `recall`, `search_raw` の前に必ず実行されます。

- `auto_switch_repo=true`（既定）
- `auto_switch_subproject=false`（既定）
- `pin_mode=true` の間は自動スイッチしない

## CI イベント連携

- エンドポイント: `POST /v1/ci-events`
- イベント: `ci.success`, `ci.failure`
- Slack 通知では `ci.` prefix をフィルタに含めると運用しやすい

## よく使うコマンド

```shell
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm test:workspace
```
