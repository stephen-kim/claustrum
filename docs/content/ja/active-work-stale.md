# Active Work の陳腐化と自動クローズ

Active Work は最近のプロジェクトシグナルから推論され、定期的に再計算されます。

## 主要フィールド

`active_work` の主要フィールド:

- `stale` / `stale_reason`
- `last_evidence_at`
- `status`（`inferred` | `confirmed` | `closed`）
- `closed_at`

## Workspace ポリシー

Workspace Settings で次を設定します。

- `active_work_stale_days`（既定: `14`）
- `active_work_auto_close_enabled`（既定: `false`）
- `active_work_auto_close_days`（既定: `45`）

## 判定ルール

- `last_evidence_at` が `stale_days` を超えると、対象を stale としてマークします。
- auto-close が有効で、stale 状態が `auto_close_days` を超えた場合、inferred 項目を close します。
- confirmed 項目は既定で auto-close の対象外です。

## 実行トリガー

- 手動: `POST /v1/projects/:key/recompute-active-work`
- 定期: 夜間の再計算ジョブ

最終更新: 2026-02-19
