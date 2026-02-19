# GitHub Integration（Workspace 単位）

## このページの範囲

このページでは GitHub 連携の基盤を扱います。

- Workspace に GitHub App installation を接続
- リポジトリ一覧を Claustrum に同期
- project linking / permission sync の基礎データを準備

関連ページ:
- [GitHub Auto Projects](github-auto-projects)
- [GitHub Permission Sync](github-permission-sync)
- [GitHub Webhooks](github-webhooks)

## Workspace モデル

1 workspace あたり GitHub App installation は **0 または 1** を前提にしています。

- `github_installations`: installation メタデータ
- `github_repo_links`: 同期した repo のキャッシュ

## 環境変数

必須:
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`

任意:
- `GITHUB_APP_WEBHOOK_SECRET`（webhook を使う場合は必須）
- `GITHUB_APP_NAME`, `GITHUB_APP_URL`
- `MEMORY_CORE_GITHUB_STATE_SECRET`

`GITHUB_APP_PRIVATE_KEY` は以下をサポート:
- raw PEM
- 改行エスケープされた PEM（`\n`）
- base64 PEM

## 接続フロー

1. Admin UI から install URL を取得
2. GitHub installation 画面へ遷移
3. callback で state と管理者権限を検証
4. `github_installations` を upsert

## 主な API

- `GET /v1/workspaces/:key/github/install-url`
  - 権限: workspace admin 以上

- `GET /v1/auth/github/callback?installation_id=...&state=...`
  - state 署名検証
  - `github_installations` upsert
  - audit: `github.installation.connected`

- `POST /v1/workspaces/:key/github/sync-repos`
  - 権限: workspace admin 以上
  - installation token を短命で発行（保存しない）
  - `github_repo_links` を upsert
  - audit: `github.repos.synced`

- `GET /v1/workspaces/:key/github/repos`
  - 権限: workspace member 以上
  - active な repo キャッシュを返す

- `GET /v1/workspaces/:key/github/installation`
  - 権限: workspace member 以上
  - 接続状態を返す

## セキュリティ注意点

- installation token は短命かつ永続化しない
- callback state は署名付き + 有効期限あり
- callback 時に actor が admin/owner か再検証
- private key はサーバー内でのみ利用
