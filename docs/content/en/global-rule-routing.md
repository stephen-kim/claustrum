# Global Rule Routing

## Purpose

Global Rules should not be injected as a static block for every question.
Claustrum routes rules dynamically so the bundle stays relevant while preserving critical safeguards.

## Core Rules

- `pinned=true` rules are always included.
- `severity=high` rules are always included (subject to budget warnings).
- Other rules are selected by routing score.

## Routing Modes

- `semantic`: token-similarity focused.
- `keyword`: direct keyword/tag overlap focused.
- `hybrid` (default): semantic + keyword blend.

Workspace settings:

- `global_rules_routing_enabled` (default: `true`)
- `global_rules_routing_mode` (default: `hybrid`)
- `global_rules_routing_top_k` (default: `5`)
- `global_rules_routing_min_score` (default: `0.2`)

## Score Model

For non-pinned/non-high rules:

`score = semantic_similarity * w_sem + keyword_overlap * w_kw + priority_weight + recency_weight - length_penalty`

Where:

- `semantic_similarity`: cosine similarity over query and rule tokens.
- `keyword_overlap`: overlap ratio of query tokens vs rule content/tags.
- `priority_weight`: higher weight for lower numeric priority.
- `recency_weight`: newer rules get a small boost.
- `length_penalty`: very long rules are slightly penalized.

## Query Source

Routing query (`q_used`) is selected in this order:

1. Explicit `q` from `/v1/context/bundle`
2. Pseudo-query built from project summary, active work, recent activity, and current subpath

## Budget Interaction

Routing ranks rules first, then token budget is applied.
If omitted rules become large, summary fallback is used per workspace settings.

## Admin UI

Workspace → Global Rules:

- Routing enabled toggle
- Routing mode select
- `top_k` input
- `min_score` input

Project → Context Debug:

- Enter test query
- Load debug bundle
- Inspect selected/dropped rule IDs and score breakdown

## Operational Guidance

- Keep `top_k` small (`3~8`) for better focus.
- Increase `min_score` when too many low-quality rules appear.
- Add tags (`security`, `commit`, `naming`, etc.) to improve keyword routing quality.

Last Updated: 2026-02-18
