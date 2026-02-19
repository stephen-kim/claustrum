# コンテキストデバッグ

Context Debug は「なぜこの bundle 結果になったか」を説明するための画面です。

## 確認できる内容

- 適用中 persona と推奨 persona
- 推奨理由と confidence
- global rule routing の選択結果
- active work candidates と score breakdown
- retrieval スコア（FTS/vector + boosts）
- token budget 配分
- active work policy（`stale_days`, `auto_close`）

## Debug Bundle の取得

- `GET /v1/context/bundle?...&mode=debug`

主なフィールド:
- `persona_applied`
- `persona_recommended`
- `weight_adjustments`
- `active_work_candidates`
- `active_work_policy`
- `token_budget`

## 手動オーバーライド

Admin UI から次を実行できます。

- 推奨 persona の適用
- active work の confirm/pin
- active work の close/reopen

自動化を不透明にしないため、すべて明示操作になっています。

最終更新: 2026-02-19
