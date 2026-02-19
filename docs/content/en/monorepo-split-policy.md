# Monorepo Split Policy


## Modes

`monorepo_context_mode` supports three modes:

1. `shared_repo` (default)
2. `split_on_demand`
3. `split_auto` (advanced)


## Comparison

### `shared_repo`

- Active project key stays at repo level (`github:owner/repo`).
- Subpath is kept as metadata for ranking/boost.
- Lowest operational overhead.

### `split_on_demand`

- Only explicitly listed subpaths are isolated.
- Policy source: `monorepo_subproject_policies`.
- Unlisted subpaths remain on repo-level project.
- Recommended split strategy for production teams.

### `split_auto`

- Resolver can create/use `repo#subpath` automatically with guardrails.
- More aggressive and convenient, but can create more projects.
- Keep this off unless your team wants automatic per-subpath isolation.


## Why Split-On-Demand Is the Default Split Strategy

- Prevents accidental project explosion in large monorepos.
- Gives administrators explicit control of boundaries.
- Keeps shared context available where strict split is not needed.


## Operational Guide

1. Start with `shared_repo`.
2. Switch to `split_on_demand` when one or two subpaths need isolation.
3. Add policies for the exact subpaths to isolate.
4. Use `split_auto` only when your workflow tolerates automatic expansion.


## Policy Table

`monorepo_subproject_policies`

- `workspace_id`
- `repo_key`
- `subpath`
- `enabled`

Only enabled rows are used in `split_on_demand` resolution.


## Resolver Behavior Summary

- `shared_repo`:
  - active project = `repo_key`
- `split_on_demand`:
  - if `(repo_key, subpath)` is enabled in policy table:
    - active project = `repo_key#subpath`
    - create project on first use if missing
  - else:
    - active project = `repo_key`
- `split_auto`:
  - follows automatic split behavior with existing guardrails


## Rename Handling

Repository/subpath rename alias mapping is planned as future work.
Current recommendation: keep old entries temporarily and migrate policies step by step.
