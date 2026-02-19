# GitHub 権限同期

GitHub 側の権限を Claustrum の project role に反映する機能です。

## 全体フロー

1. GitHub App installation を接続
2. repo sync 実行
3. `github_user_links` を設定
4. permission sync（まず dry-run、次に apply）

## 同期モード

### `add_only`（既定）
- 追加と昇格のみ
- 削除/降格はしない

### `add_and_remove`
- 追加/更新/削除を反映
- 権限を失ったユーザーの削除を反映
- owner 保護は維持

## デフォルト role mapping

```json
{
  "admin": "maintainer",
  "maintain": "maintainer",
  "write": "writer",
  "triage": "reader",
  "read": "reader"
}
```

## unmatched user の扱い

GitHub 側ユーザーに user link がない場合:

- `skipped_unmatched` にカウント
- preview で unmatched として表示
- Claustrum 側 role は変更しない

## 主要 API

- `GET /v1/workspaces/:key/github/user-links`
- `POST /v1/workspaces/:key/github/user-links`
- `DELETE /v1/workspaces/:key/github/user-links/:userId`
- `POST /v1/workspaces/:key/github/sync-permissions`
- `GET /v1/workspaces/:key/github/permission-status`
- `GET /v1/workspaces/:key/github/permission-preview`
- `GET /v1/workspaces/:key/github/cache-status`
