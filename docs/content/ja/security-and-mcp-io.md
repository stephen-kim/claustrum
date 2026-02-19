# セキュリティと MCP I/O

## MCP stdio ポリシー

MCP サーバー / adapter は次を厳守します。

- `stdout`: JSON-RPC プロトコルのみ
- `stderr`: ログ / エラーのみ

起動バナーやデバッグ文、マイグレーション出力を stdout に出してはいけません。

## Raw データのガードレール

- Raw 検索は snippet のみ返す
- 単一メッセージ表示も snippet のみ
- `max_chars` を必ず強制
- デフォルトでセッション全文は返さない

## アクセス制御

- API key 認証が必須（`Authorization: Bearer <key>`）
- `raw.search` / `raw.view` は厳格に制御
  - 原則: 管理者またはプロジェクト権限ユーザー
  - workspace 全体検索は workspace admin/owner を要求

## 監査要件

次のイベントは必ず記録し、定期的にレビューします。

- `raw.search`
- `raw.view`

監査ログには少なくとも actor / target / timestamp を含めます。

## デプロイ時の注意

- 外部 DB 接続は TLS を使用（例: `sslmode=require`）
- API key は定期ローテーション
- 秘密情報を stderr に出力しない
