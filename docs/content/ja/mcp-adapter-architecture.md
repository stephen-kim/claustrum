# MCP Adapter アーキテクチャ

Claustrum の MCP adapter はローカルで動く薄いプロセスです。  
実際のコンテキスト処理とデータ保存はリモートの Claustrum サーバー側で行います。

## ランタイム構成

```text
~/.claustrum/
  bin/claustrum-mcp
  adapter/
    current/
    versions/vX.Y.Z/
  logs/
    adapter.log
    error.log
  state.json
  update.lock
```

## リクエストの流れ

1. MCP クライアントが stdio で JSON-RPC を送信
2. ローカル adapter が stdin から MCP フレームを受信
3. `POST ${CLAUSTRUM_BASE_URL}/v1/mcp` へ転送
4. サーバー応答を stdout に JSON-RPC として返却
5. ログは stderr とファイルにのみ出力

## stdout 安全性とログ方針

- `stdout`: JSON-RPC のみ
- `stderr`: 運用ログ / エラー

ログローテーション:
- `adapter.log` 最大 5MB
- `error.log` 最大 5MB
- `~/.claustrum/logs` 合計 10MB 上限

API key、Bearer token、秘密鍵ブロックなどはログ出力前にマスクされます。

## 自動更新フロー

- GitHub Releases を ETag 付きでチェック
- `update.lock` で同時更新を防止
- `SHA256SUMS` でダウンロード検証
- `adapter/current` の symlink を原子的に切り替え
- 失敗時は旧バージョンを維持

## セキュリティ前提

- 本番では `CLAUSTRUM_BASE_URL` に HTTPS を使用
- TLS 証明書検証は無効化しない
- 更新元は許可済みリポジトリに固定

## トラブルシュート

- 接続失敗: `CLAUSTRUM_BASE_URL` / ネットワーク / TLS 証明書チェーンを確認
- 更新されない: `~/.claustrum/state.json`, `update.lock`, `~/.claustrum/logs/error.log` を確認
- MCP エラー: stdout に JSON-RPC 以外が混ざっていないか確認
