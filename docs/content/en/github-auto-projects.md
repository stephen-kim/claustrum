# GitHub Auto Projects


## Purpose

Automatically map synced GitHub repositories to Claustrum projects at the workspace level.

- Sync always caches repositories in `github_repo_links`.
- Repo-level project auto-creation is optional (`github_auto_create_projects`).
- Subproject auto-creation is optional and only applies in split mode (`github_auto_create_subprojects`).


## Project Key Rules

- Repo key: `{github_project_key_prefix}{owner}/{repo}`
- Split subproject key: `{github_project_key_prefix}{owner}/{repo}#{subpath}`

Examples:

- `github:acme/platform`
- `github:acme/platform#apps/admin-ui`


## Shared vs Split

- `shared_repo` (default):
  - Active project key stays repo-level.
  - Subpath is stored in `metadata.subpath`.
  - Recall/search can boost rows that match the current subpath.
- `split_on_demand`:
  - Active key becomes `repo#subpath` only when that subpath is listed in `monorepo_subproject_policies`.
  - Unlisted subpaths always fallback to repo-level project.
- `split_auto`:
  - Active key can become `repo#subpath` whenever subpath is detected.
  - If subproject auto-create is disabled, resolver falls back to repo-level project.


## Sync Behavior (`POST /v1/workspaces/:key/github/sync-repos`)

1. Fetch repositories from GitHub App installation.
2. Upsert `github_repo_links` rows.
3. If `github_auto_create_projects=true`:
   - Upsert repo-level project.
   - Ensure `project_mappings(kind=github_remote, external_id=owner/repo)`.
   - Link `github_repo_links.linked_project_id` to the repo-level project.
4. Subproject projects are not created during sync.


## Resolver Behavior (`POST /v1/resolve-project`)

- `shared_repo`:
  - Resolve to repo-level project.
  - Subpath is not turned into a separate project key.
- `split_on_demand`:
  - When subpath is detected and policy row exists, resolve `repo#subpath`.
  - If policy row is missing, fallback to repo-level project.
- `split_auto`:
  - When subpath is detected, try `repo#subpath`.
  - If subproject mapping/project is missing:
    - auto-create only when `github_auto_create_subprojects=true`
    - otherwise fallback to repo-level project.


## Subpath Guardrails

- Normalize slashes and case.
- Replace whitespace and invalid characters with `-`.
- Remove empty path segments.
- Enforce `monorepo_max_depth`.
- Exclude blocked paths such as `node_modules`, `.git`, `dist`, `build`, `.next`.


## Audit Events

- `github.repos.synced`
- `github.projects.auto_created`
- `github.projects.auto_linked`
