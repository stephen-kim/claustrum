# 監査ログ保持ポリシー

監査データと raw データの保持期間を workspace 単位で管理します。

## 設定項目

- `retention_policy_enabled`（既定: `false`）
- `audit_retention_days`（既定: `365`）
- `raw_retention_days`（既定: `90`）
- `retention_mode`（`archive` | `hard_delete`, 既定: `archive`）

## データ処理

### raw_events
- `raw_retention_days` を超えた行を削除

### audit_logs
- `archive`（推奨）:
  - 古い行を `audit_logs_archive` に退避
  - 元テーブルから削除
- `hard_delete`:
  - 古い行を直接削除

## 実行

- 日次 retention job が実行
- `retention_policy_enabled=true` の workspace のみ対象
- 実行ごとに `audit.retention.run` を記録

記録される主な値:
- `retention_mode`
- `audit_retention_days`
- `raw_retention_days`
- `archived_count`
- `deleted_count`
- `raw_deleted_count`

## 運用の推奨

- まずは `archive` から開始
- 企業環境では audit を 180〜365 日以上保持推奨
- `hard_delete` は法務要件がある場合のみ

最終更新: 2026-02-19
