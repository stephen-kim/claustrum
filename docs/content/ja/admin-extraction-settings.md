# 抽出設定（Admin）

このページでは、raw Git イベントを `activity` / `decision` memory に変換する設定を管理します。

補足: locale 設定は outbound メッセージ用で、抽出ロジック自体には影響しません。

## 設定場所

Admin Console:

- `Project Resolution Settings` -> Extraction Pipeline
- `Decision Keyword Policies`
- `Decisions`

## 抽出パイプライン設定

- `enable_activity_auto_log`
  - commit/merge ごとに `activity` memory を作成
- `enable_decision_extraction`
  - 非同期 LLM decision 抽出を有効化
- `decision_extraction_mode`
  - `llm_only`: 新しいイベント順で処理
  - `hybrid_priority`: スコアの高いイベントを優先
- `decision_default_status`
  - LLM 生成 decision の初期ステータス
- `decision_auto_confirm_enabled`
  - 自動 confirm の有効化
- `decision_auto_confirm_min_confidence`
  - auto-confirm 閾値
- `decision_batch_size`
  - 1 回の抽出で処理する最大件数
- `decision_backfill_days`
  - 遡って処理する日数

## キーワードポリシー（スケジューリング専用）

各ポリシーには次を設定します。

- positive / negative keywords
- positive / negative file path patterns
- positive / negative weights
- enabled

重要: keyword policy は LLM ジョブの優先度調整のみです。  
イベントを decision と確定する用途ではありません。

## Decisions パネル

- フィルタ: project / status / confidence range
- evidence 表示: `raw_event_id`, `commit_sha`
- 操作: `Confirm`, `Reject`

## 推奨デフォルト

- `enable_activity_auto_log = true`
- `enable_decision_extraction = true`
- `decision_extraction_mode = llm_only`
- `decision_default_status = draft`
- `decision_auto_confirm_enabled = false`
- `decision_auto_confirm_min_confidence = 0.90`
- `decision_batch_size = 25`
- `decision_backfill_days = 30`

最終更新: 2026-02-19
