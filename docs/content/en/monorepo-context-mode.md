# Monorepo Context Mode

Claustrum supports three workspace-level policies for monorepo memory scope.


## Modes

### 1) `shared_repo` (default)

- Active `project_key` stays at repo level: `github:org/repo`
- Detected subpath is stored in memory metadata as `metadata.subpath`
- Recall/search can apply a subpath ranking boost with `current_subpath`
- Good when teams want cross-subproject memory sharing with reduced noise

### 2) `split_on_demand` (recommended split default)

- Active `project_key` is split only when a subpath is listed in `monorepo_subproject_policies`
- For listed subpaths, key becomes `github:org/repo#apps/admin-ui`
- For unlisted subpaths, resolver falls back to the repo-level key
- Good when only specific packages/apps need isolation

### 3) `split_auto` (advanced)

- Any detected subpath can resolve as `repo#subpath`
- If auto-create for subprojects is enabled, missing subprojects can be created automatically
- Best for mature monorepos with strict path hygiene and guardrails


## Workspace Settings

- `monorepo_context_mode`: `shared_repo` | `split_on_demand` | `split_auto`
- `monorepo_subpath_metadata_enabled`: store `metadata.subpath` in shared mode
- `monorepo_subpath_boost_enabled`: apply result boost for current subpath in shared mode
- `monorepo_subpath_boost_weight`: boost multiplier (default `1.5`)


## Example Keys

- Shared: `github:acme/claustrum`
- Split: `github:acme/claustrum#apps/memory-core`


## Notes

- Resolver fallback order is unchanged: `github_remote > repo_root_slug > manual`
- If subpath detection fails in split modes, Claustrum falls back to repo key
- Admin UI controls are under **Project Resolution Settings → Monorepo Context**
