# Search Ranking (Hybrid)

Claustrum search defaults to hybrid retrieval and applies predictable boosts.

## Base Retrieval

- `keyword`: Postgres FTS candidates
- `semantic`: embedding similarity candidates
- `hybrid`: weighted combination of keyword + semantic scores

## Workspace-Tunable Boosts

Workspace settings control ranking behavior:

- `search_type_weights` (JSON map)
- `search_recency_half_life_days` (default 14)
- `search_subpath_boost_weight` (default 1.5)

## Effective Score

`final = base_score * type_boost * recency_boost * subpath_boost`

Where:

- `type_boost` favors decision/constraint-heavy context
- `recency_boost` decays by half-life
- `subpath_boost` applies in shared monorepo mode when `metadata.subpath` matches current subpath

## Debug Breakdown

When `debug=true`, each result can include:

- `vector`
- `fts`
- `type_boost`
- `recency_boost`
- `subpath_boost`
- `final`

Last Updated: 2026-02-17
