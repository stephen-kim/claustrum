# GitHub Permission Calculation


## Purpose

Claustrum computes repo access using a strict merge rule:

`final permission = max(direct collaborator permission, team-derived permissions)`

Order:

`admin > maintain > write > triage > read`


## Data Sources

For each linked repository:

1. Direct collaborators (`/repos/{owner}/{repo}/collaborators`)
2. Repo teams (`/repos/{owner}/{repo}/teams`)
3. Team members (`/orgs/{org}/teams/{slug}/members`)

Team permissions are expanded into user permissions, then merged with direct collaborator permissions using the max rule.


## Cache Strategy

Workspace setting:

- `github_cache_ttl_seconds` (default: `900`)

Caches:

- `github_repo_teams_cache`
- `github_team_members_cache`
- `github_permission_cache` (computed per repo/user)

Behavior:

- If repo-team or team-members cache is fresh (< TTL), reuse cache
- If stale/missing, call GitHub API and upsert cache
- Sync continues in best-effort mode with limited retries


## Sync Modes

### `add_only`

- Adds missing members
- Upgrades role when needed
- Does not remove or downgrade existing members

### `add_and_remove`

- Adds/updates/removes linked users to match computed GitHub permissions
- Owner/admin protection remains in effect
- Removal is applied only for repos that were successfully computed


## Endpoints

- `POST /v1/workspaces/:key/github/sync-permissions`
  - body: `{ dry_run?: boolean, repos?: string[], project_key_prefix?: string }`
- `GET /v1/workspaces/:key/github/permission-preview?repo=owner/repo`
- `GET /v1/workspaces/:key/github/cache-status`


## Operational Notes

- Start with `dry_run=true` (preview mode).
- Keep `github_user_links` up to date to reduce unmatched users.
- Prefer linking `github_user_id` for rename safety.
- If rate limit warnings appear, run smaller repo subsets (`repos`) or increase sync interval.
