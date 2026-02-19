# GitHub Permission Sync


## Overview

GitHub Permission Sync has two parts:

1. Link Claustrum users to GitHub identities (`github_user_links`)
2. Sync repository permissions into Claustrum project roles

For detailed permission math and cache behavior, see:

- [GitHub Permission Calculation](github-permission-calculation)


## Flow

1. Connect GitHub App installation
2. Sync repositories to cache and link repo-level projects
3. Create user links (`user_id` ↔ `github_login`, optional `github_user_id`)
4. Run permission sync (`dry_run` first (preview), then apply)
5. Claustrum computes `max(direct collaborator, team-derived permission)` before role mapping


## Modes

### `add_only` (default)

- Adds missing `project_members`
- Upgrades role when GitHub permission implies a higher role
- Does not remove members
- Does not downgrade members

### `add_and_remove`

- Applies add/update/remove for linked users
- Removes linked users that no longer have repo permission
- Owner protection rule is applied


## Default Role Mapping

```json
{
  "admin": "maintainer",
  "maintain": "maintainer",
  "write": "writer",
  "triage": "reader",
  "read": "reader"
}
```


## Operational Tips

- Use `dry_run=true` before applying changes in production workspaces.
- Large installations should sync in scheduled batches.
- GitHub API limits can cause partial success; check repo error list in sync result.
- Prefer storing `github_user_id` for rename resilience (login can change).


## Unmatched Users

If a GitHub collaborator has no `github_user_links` match:

- it is counted in `skipped_unmatched`
- it appears in `unmatched_users` preview
- no Claustrum role is changed for that identity


## Endpoints

- `GET /v1/workspaces/:key/github/user-links`
- `POST /v1/workspaces/:key/github/user-links`
- `DELETE /v1/workspaces/:key/github/user-links/:userId`
- `POST /v1/workspaces/:key/github/sync-permissions`
- `GET /v1/workspaces/:key/github/permission-status`
- `GET /v1/workspaces/:key/github/permission-preview?repo=owner/repo`
- `GET /v1/workspaces/:key/github/cache-status`
