# Context Debug

Context Debug explains why the bundle contains current results.

## What You Can Inspect

- Active persona and recommended persona
- Recommendation reasons and confidence
- Global rule routing mode and selected rules
- Active Work candidates with score breakdown
- Retrieval score breakdown (FTS/vector + boosts)
- Token budget allocations across sections
- Active Work policy (`stale_days`, `auto_close`)

## Context Bundle Debug Contract

Use:

- `GET /v1/context/bundle?...&mode=debug`

Debug includes:

- `persona_applied`
- `persona_recommended`
- `weight_adjustments`
- `active_work_candidates`
- `active_work_policy`
- `token_budget`

## Overrides

From Admin UI Context Debug:

- Apply recommended persona (manual action)
- Confirm/Pin active work
- Close/Reopen active work

These controls are intentionally explicit to keep automation transparent and admin-controlled.

Last Updated: 2026-02-18
