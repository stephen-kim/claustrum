# Notion 連携

## 目的

Notion を AI ワークフローの外部コンテキストとして使います。

- セッション中にドキュメントを検索/参照
- 必要なら merge 時の write-back も可能

## 事前に必要なもの

- Notion integration token
- 対象ページ/データベースをその integration に共有済みであること
- `workspace_key`（例: `personal`）

## ENV（フォールバック）

- `MEMORY_CORE_NOTION_TOKEN`
- `MEMORY_CORE_NOTION_DEFAULT_PARENT_PAGE_ID`
- `MEMORY_CORE_NOTION_WRITE_ENABLED`

## セットアップ手順

1. Notion integration を作成し token を取得
2. Admin UI で Notion 設定を保存
   - `enabled=true`
   - `token`
   - `default_parent_page_id`（任意）
   - `write_enabled`（書き込み API を使う場合）
3. API 経由で保存（任意）
4. `/v1/notion/search` と `/v1/notion/read` で疎通確認
5. MCP ツールで確認
   - `notion_search`
   - `notion_read`
   - `notion_context`

## API エンドポイント

- `GET /v1/notion/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/notion/read?workspace_key=<ws>&page_id=<id-or-url>&max_chars=4000`
- `POST /v1/notion/write`（admin のみ）

## 権限と監査

- read/search: workspace member 以上
- write: workspace admin + `write_enabled=true`
- 監査イベント:
  - `notion.search`
  - `notion.read`
  - `notion.write`

## merge ベース write を推奨する理由

ローカル hook より CI での merge トリガー連携の方が運用安定性が高いです。

- 実行環境と secrets を統一しやすい
- 開発者ローカル差分の影響を減らせる

## ENV と Admin UI の優先順位

- デフォルト: Admin UI（DB）が優先
- `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=notion` を設定すると ENV 固定

## トラブルシュート

- 検索/参照エラー: token とページ共有設定を確認
- 書き込み失敗: admin 権限 + `write_enabled=true` を確認
- merge 書き込みが動かない: `write_on_merge` とイベント連携設定を確認
