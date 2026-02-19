# LLM 用量追踪

Claustrum 会按每次 LLM 调用记录用量事件，用于观察 token 消耗和预估成本。

## 记录字段

- `workspace_id`
- `project_id`（如果有）
- `actor_user_id` 或 `system_actor`
- `purpose`（如 `decision_extract`、`summarize`、`routing`、`eval_judge`）
- `provider`, `model`
- `input_tokens`, `output_tokens`（provider 返回时）
- `estimated_cost_cents`（基于 `llm_pricing`）
- `correlation_id`
- `created_at`

## 不记录内容

- prompt 原文
- response 原文
- Authorization 头与 API key

## 成本计算

`llm_pricing` 维护模型单价：

```text
estimated_cost_cents =
  (input_tokens / 1000) * input_token_price_per_1k_cents +
  (output_tokens / 1000) * output_token_price_per_1k_cents
```text

## Usage API

`GET /v1/usage/llm`

参数：
- `workspace_key`（必填）
- `from`（可选）
- `to`（可选）
- `group_by` = `day | purpose | model`（默认 `day`）

## Admin UI

在 **LLM Usage** 面板中可查看：

- 按天/用途/模型的聚合
- 时间范围过滤
- 输入/输出 token 总量
- 预估成本总计
- 分组明细表
