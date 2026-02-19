# 認証とロール

Claustrum は、API キーでユーザーを識別し、workspace / project ロールでアクセスを制御します。

## ロール構成

### Workspace ロール
- `owner`
- `admin`
- `member`

### Project ロール
- `owner`
- `maintainer`
- `writer`
- `reader`

補足:
- workspace の `owner` / `admin` は、同じ workspace 内の project 権限を運用目的でオーバーライドできます。

## 権限の目安

| 操作 | 必要ロール |
| --- | --- |
| Workspace メンバー一覧 | workspace `member` |
| Workspace メンバー管理 | workspace `admin` |
| Project 作成 / 一覧 | workspace `member` |
| Project メンバー一覧 | project `reader` |
| Project メンバー管理 | project `maintainer` |
| Memory 作成 | project `writer` |
| Memory 閲覧 | project `reader` |
| Decision confirm/reject | project `maintainer` |
| Raw search / Raw view | `raw_access_min_role`（既定: `writer`） |

## Raw アクセス方針

- `/v1/raw/search` と `/v1/raw/messages/:id` の最小ロールは `workspace_settings.raw_access_min_role` で制御します。
- 既定値は `writer` です。
- すべての raw アクセスは監査ログに残ります（`raw.search`, `raw.view`）。

## 監査ログ

次の重要操作は必ず `audit_logs` に記録されます。
- `memory.create`
- `memory.update`
- `memory.delete`
- `decision.confirm`
- `decision.reject`
- メンバー管理 / API キー管理

最終更新: 2026-02-19
