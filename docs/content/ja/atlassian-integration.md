# Atlassian Integration（Jira + Confluence）

## 目的

Jira と Confluence を MCP ワークフローの外部コンテキストとして利用します。

- Jira: issue の検索 / 参照
- Confluence: ドキュメントの検索 / 参照
- どちらも read 中心で、操作は監査対象

## 事前に必要なもの

- Atlassian Cloud サイト URL（例: `https://your-org.atlassian.net`）
- Atlassian アカウントのメール
- Atlassian API token
- memory-core 上の `workspace_key`（例: `personal`）

## ENV（フォールバック）

Jira:
- `MEMORY_CORE_JIRA_BASE_URL`
- `MEMORY_CORE_JIRA_EMAIL`
- `MEMORY_CORE_JIRA_API_TOKEN`

Confluence:
- `MEMORY_CORE_CONFLUENCE_BASE_URL`
- `MEMORY_CORE_CONFLUENCE_EMAIL`
- `MEMORY_CORE_CONFLUENCE_API_TOKEN`

## セットアップ手順

1. Atlassian API token を作成
- 1 つの token を Jira/Confluence で共通利用できます。

2. Admin UI で設定保存
- `enabled=true`
- `base_url`, `email`, `api_token`
- 必要なら `write_on_commit`, `write_on_merge`（現在は監査/ルーティング用途）

3. API で設定保存（任意）

```bash
curl -X PUT "$MEMORY_CORE_URL/v1/integrations" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_key": "personal",
    "provider": "jira",
    "enabled": true,
    "reason": "enable jira context",
    "config": {
      "base_url": "https://your-org.atlassian.net",
      "email": "you@company.com",
      "api_token": "atlassian-token"
    }
  }'
```

4. 接続確認
- `/v1/jira/search`
- `/v1/confluence/search`

5. MCP ツール確認
- `jira_search`, `jira_read`
- `confluence_search`, `confluence_read`

## API エンドポイント

Jira:
- `GET /v1/jira/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/jira/read?workspace_key=<ws>&issue_key=<ABC-123>&max_chars=4000`

Confluence:
- `GET /v1/confluence/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/confluence/read?workspace_key=<ws>&page_id=<id-or-url>&max_chars=4000`

## 権限と監査

- 検索/閲覧は workspace member 以上
- 監査イベント:
  - `jira.search`
  - `jira.read`
  - `confluence.search`
  - `confluence.read`

## ENV と Admin UI の優先順位

- デフォルト: Admin UI（DB 保存）が優先
- `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=jira,confluence` の場合は ENV 固定

## トラブルシュート

- `Invalid API key`: `Authorization` ヘッダーを確認
- `Integration not configured`: 該当 workspace に設定保存済みか確認
- 検索は通るが read が失敗: Atlassian 側の権限を確認
