# GitHub Webhook 自動同期

GitHub イベントを受信し、必要な範囲だけ自動同期する仕組みです。

## 何をしているか

- `POST /v1/webhooks/github` で受信
- 署名検証（`X-Hub-Signature-256`）
- `delivery_id` で重複防止
- queue に積んで即時 200 応答
- worker が非同期で処理

## 対応イベント（主要）

- `installation_repositories`
  - repo sync
  - 影響 repo の permission 再計算
- `team`, `membership`
  - team mapping 適用
- `repository` rename
  - repo link メタデータ更新

## セキュリティ

- secret は `GITHUB_APP_WEBHOOK_SECRET`（env）
- 署名不正は enqueue 前に拒否
- retry は最大 3 回

## Admin UI

**Workspace -> Integrations -> GitHub**

- webhook 有効/無効
- sync mode 設定
- delivery 状態（queued/processing/done/failed）

## うまく動かない時の確認

1. webhook secret 一致確認
2. installation 接続確認
3. team mapping / user links 設定確認

最終更新: 2026-02-19
