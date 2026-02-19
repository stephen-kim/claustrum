# Active Work タイムライン

Active Work の重要な状態変化は、すべて不変のタイムラインイベントとして記録されます。

## イベントストア

テーブル: `active_work_events`

イベント種別:

- `created`
- `updated`
- `stale_marked`
- `stale_cleared`
- `confirmed`
- `closed`
- `reopened`

各イベントには次の情報を含められます。

- score / evidence の詳細
- 変更前後の状態
- 任意の `correlation_id`

## API

- `GET /v1/projects/:key/active-work`
- `GET /v1/projects/:key/active-work/events`
- `POST /v1/active-work/:id/confirm`
- `POST /v1/active-work/:id/close`
- `POST /v1/active-work/:id/reopen`

## 管理画面

Context Debug で以下を確認できます。

- 現在の active work 一覧
- stale / closed 状態
- イベントタイムライン（JSON 詳細付き）
- 手動操作（maintainer 以上）

手動操作は監査ログに残ります。

- `active_work.manual_confirm`
- `active_work.manual_close`
- `active_work.manual_reopen`

最終更新: 2026-02-19
