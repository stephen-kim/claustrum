# アクセス変更タイムライン

Access 変更履歴を一貫形式で追跡するための仕様と UI ガイドです。

## 目的

管理者が次を答えられるようにします。
- 誰がアクセスを変更したか
- 何が変わったか（追加 / ロール変更 / 削除）
- なぜ変わったか（manual / github / oidc / system）
- どのジョブや webhook が起点か

## Action Key 分類

Workspace:
- `access.workspace_member.added`
- `access.workspace_member.role_changed`
- `access.workspace_member.removed`

Project:
- `access.project_member.added`
- `access.project_member.role_changed`
- `access.project_member.removed`

## 標準 `params`

各イベントで最低限保持:
- `source`
- `target_user_id`
- `old_role`
- `new_role`
- `workspace_key`
- `project_key`（project イベントのみ）
- `correlation_id`（推奨）
- `evidence`（任意）

## Correlation ID の使い方

同じ処理に紐づく大量変更をまとめて分析できます。

例:
- GitHub webhook delivery id
- permission sync job id
- OIDC sync transaction id

## API

- `GET /v1/audit/access-timeline`

主な query:
- `workspace_key`（必須）
- `project_key`
- `user_id`
- `source`
- `action`（`add|change|remove`）
- `from`, `to`
- `limit`, `cursor`

## Admin UI フィルタ

- project
- target user
- source
- action
- date range
- cursor pagination

最終更新: 2026-02-19
