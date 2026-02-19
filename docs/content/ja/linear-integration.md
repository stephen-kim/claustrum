# Linear 連携

## 目的

Linear を issue コンテキストの外部ソースとして利用します。

- issue 検索
- issue 詳細の参照
- memory-first の recall を補助

## 事前に必要なもの

- Linear API key（Personal API key）
- 必要ならカスタム API URL（既定: `https://api.linear.app/graphql`）
- `workspace_key`（例: `personal`）

## ENV（フォールバック）

- `MEMORY_CORE_LINEAR_API_KEY`
- `MEMORY_CORE_LINEAR_API_URL`

## セットアップ手順

1. Linear API key を作成
2. Admin UI の Integrations -> Linear で保存
   - `enabled=true`
   - `api_key`
   - `api_url`（任意）
3. API で保存（任意）
4. `/v1/linear/search` と `/v1/linear/read` で確認
5. MCP ツールで確認
   - `linear_search`
   - `linear_read`

## API エンドポイント

- `GET /v1/linear/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/linear/read?workspace_key=<ws>&issue_key=<ENG-123>&max_chars=4000`

## 権限と監査

- read/search: workspace member 以上
- 監査イベント:
  - `linear.search`
  - `linear.read`

## ENV と Admin UI の優先順位

- デフォルト: Admin UI（DB）が優先
- `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=linear` で ENV 固定

## トラブルシュート

- `Integration not configured`: `api_key` と `enabled=true` を確認
- 検索は通るが read 失敗: issue key の存在と API key 権限を確認
