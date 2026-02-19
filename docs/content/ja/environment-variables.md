# 環境変数（完全リファレンス）

このページは `.env.example` の補足です。  
`.env.example` は最小構成、ここでは実運用で使う変数を用途別に整理しています。

## まず必要な最小セット

- `DATABASE_URL`
- `MEMORY_CORE_API_KEY`
- `MEMORY_CORE_URL`
- `NEXT_PUBLIC_MEMORY_CORE_URL`
- localdb を使う場合のみ: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

## 重要ルール

- `memory-core` の DB 接続は **`DATABASE_URL` のみ**。
- `POSTGRES_*` は localdb プロファイルの初期化専用。
- Notion/Jira/Confluence/Linear/Slack などの連携設定は、Admin UI（DB 保存）または ENV で管理可能。
- どちらを優先するかは `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS` で制御。

## 主なカテゴリ

- Core runtime: `MEMORY_CORE_HOST`, `MEMORY_CORE_PORT`, `MEMORY_CORE_LOG_LEVEL`
- Bootstrap/Auth/Security: `MEMORY_CORE_ALLOW_BOOTSTRAP_ADMIN`, `MEMORY_CORE_SECRET` など
- GitHub App: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`
- MCP Adapter: `MEMORY_CORE_URL`, `MEMORY_CORE_API_KEY`, `MEMORY_CORE_WORKSPACE_KEY`
- Admin UI: `NEXT_PUBLIC_MEMORY_CORE_URL`, `ADMIN_UI_PORT`
- Compose: `COMPOSE_PROFILES`, `MEMORY_CORE_IMAGE`, `MCP_ADAPTER_IMAGE`, `ADMIN_UI_IMAGE`

## Integration lock の挙動

`MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS`:

- `all`: 全プロバイダを ENV 固定
- `none`: ENV を無視して DB 設定を使用
- CSV: 指定したプロバイダのみ ENV 固定

例:
- `notion,jira,confluence,linear,slack,audit_reasoner`

## 運用のおすすめ

- `.env.example` はあくまでテンプレートとして最小限を維持
- `.env` には実際に使う値だけを書く
- シークレットは Git にコミットしない
- CI では GitHub Secrets を使う
