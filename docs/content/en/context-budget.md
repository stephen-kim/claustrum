# Context Budget

Last Updated: 2026-02-18

Claustrum bundles context using token-budget partitioning instead of fixed-count clipping.

## Workspace Settings

- `bundle_token_budget_total` (default `3000`)
- `bundle_budget_global_workspace_pct` (default `0.15`)
- `bundle_budget_global_user_pct` (default `0.10`)
- `bundle_budget_project_pct` (default `0.45`)
- `bundle_budget_retrieval_pct` (default `0.30`)

## Effective Allocation

For a total budget `B`:

- workspace global budget = `B * workspace_pct`
- user global budget = `B * user_pct`
- retrieval budget = `B * retrieval_pct`
- project snapshot budget is represented by bounded snapshot sections

## Global Rule Selection

Selection order:

1. Include pinned rules first.
2. Include high-severity rules next (if budget allows after pinned).
3. Fill remaining budget via configured mode:
   - `score`
   - `recent`
   - `priority_only`

If rule count is high and summary is enabled, omitted rules are represented via summary text.

## Debug Visibility

`GET /v1/context/bundle?...&mode=debug`

Debug payload includes:

- global budget per scope
- selected/omitted counts
- selection mode
- retrieval score breakdown for memory hits

## Tuning Recommendations

- Keep `global_workspace_pct + global_user_pct` around `0.20 ~ 0.35`.
- Keep retrieval budget high enough (`>= 0.25`) for query-driven recall.
- Increase summary usage when rules grow large instead of forcing hard limits.
