# LLM Usage Tracking

Claustrum tracks LLM usage at call time for billing visibility and operational tuning.

## What Is Tracked

- `workspace_id`
- `project_id` (if available)
- `actor_user_id` or `system_actor`
- `purpose` (`decision_extract`, `summarize`, `routing`, `eval_judge`, ...)
- `provider`, `model`
- `input_tokens`, `output_tokens` (when provider returns usage)
- `estimated_cost_cents` (from `llm_pricing`)
- `correlation_id`
- `created_at`

## What Is Not Tracked

- Prompt text
- Response text
- Authorization headers or API keys

## Pricing Source

Model pricing is managed in `llm_pricing`.

- Unique key: `(provider, model)`
- Cost formula:

```text
estimated_cost_cents =
  (input_tokens / 1000) * input_token_price_per_1k_cents +
  (output_tokens / 1000) * output_token_price_per_1k_cents
```

If pricing is missing for a model, cost is reported as `0` or `null` depending on available usage metadata.

## Usage API

`GET /v1/usage/llm`

Query params:

- `workspace_key` (required)
- `from` (optional, ISO datetime)
- `to` (optional, ISO datetime)
- `group_by` = `day | purpose | model` (default: `day`)

The endpoint returns grouped rows plus totals for event count, tokens, and estimated cost.

## Admin UI

Admin Console includes an **LLM Usage** dashboard:

- Group by day/purpose/model
- Date range filter
- Total tokens and estimated cost
- Grouped breakdown table
