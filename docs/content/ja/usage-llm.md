# LLM 利用量トラッキング

Claustrum は LLM 呼び出しごとに usage イベントを記録し、token 消費と推定コストを可視化します。

## 記録対象

- `workspace_id`
- `project_id`（ある場合）
- `actor_user_id` または `system_actor`
- `purpose`（`decision_extract`, `summarize`, `routing`, `eval_judge` など）
- `provider`, `model`
- `input_tokens`, `output_tokens`（取得できる場合）
- `estimated_cost_cents`（`llm_pricing` ベース）
- `correlation_id`
- `created_at`

## 記録しないもの

- prompt 本文
- response 本文
- Authorization ヘッダーや API key

## コスト計算

`llm_pricing` の単価を使って計算します。

```text
estimated_cost_cents =
  (input_tokens / 1000) * input_token_price_per_1k_cents +
  (output_tokens / 1000) * output_token_price_per_1k_cents
```

## Usage API

`GET /v1/usage/llm`

- `workspace_key`（必須）
- `from`（任意）
- `to`（任意）
- `group_by` = `day | purpose | model`（既定: `day`）

## Admin UI

**LLM Usage** ダッシュボードで確認可能:

- 日次/用途/モデル別集計
- 期間フィルタ
- input/output token 合計
- 推定コスト合計
- グループ別詳細
