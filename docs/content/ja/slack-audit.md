# Slack 監査連携

## 目的

監査イベントを Slack に送って、チームが次をすぐ確認できるようにします。

- 誰が変更したか
- 何を変更したか
- なぜ変更したか

この連携は outbound 通知専用です（MCP 読み取りツールはありません）。

## 事前に必要なもの

- Slack Incoming Webhook URL
- `workspace_key`（例: `personal`）

## ENV（フォールバック）

- `MEMORY_CORE_AUDIT_SLACK_WEBHOOK_URL`
- `MEMORY_CORE_AUDIT_SLACK_ACTION_PREFIXES`
- `MEMORY_CORE_AUDIT_SLACK_DEFAULT_CHANNEL`
- `MEMORY_CORE_AUDIT_SLACK_FORMAT`
- `MEMORY_CORE_AUDIT_SLACK_INCLUDE_TARGET_JSON`
- `MEMORY_CORE_AUDIT_SLACK_MASK_SECRETS`

## セットアップ手順

1. Slack webhook を作成
2. Admin UI（Integrations -> Slack Audit）で保存
   - `enabled=true`
   - `webhook_url`
   - 必要なら `default_channel`, `action_prefixes`, `format`, `routes`, `severity_rules`
3. API で保存（任意）
4. 監査対象アクションを実行して Slack 配信を確認

## 代表的な設定キー

- `webhook_url`
- `default_channel`
- `action_prefixes`
- `format`（`detailed` / `compact`）
- `include_target_json`
- `mask_secrets`
- `routes`
- `severity_rules`

## ENV と Admin UI の優先順位

- デフォルト: Admin UI（DB）が優先
- `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=slack` なら ENV 固定

## トラブルシュート

- 通知が来ない: webhook URL / `enabled=true` / prefix フィルタ条件を確認
- `provider locked` エラー: lock 設定を見直す
