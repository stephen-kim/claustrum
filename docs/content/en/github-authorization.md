# GitHub Authorization

## Scope

GitHub authorization in Claustrum is workspace-scoped and project-oriented.

- One workspace connects one GitHub App installation (default model).
- Repo metadata is synced into workspace-local cache.
- Project roles are derived from GitHub permissions.

## Workspace-Level GitHub App Installation

Flow:

1. Connect GitHub App for a workspace.
2. Store installation metadata.
3. Sync repositories into `github_repo_links`.
4. Link repositories to Claustrum projects.

## Repo -> Project Auto Creation

Claustrum supports repo-driven project provisioning.

- Default repo key form: `github:owner/repo`
- Shared mode: use repo-level project only.
- Split modes: optional subproject expansion policy.

## Permission Calculation

Project-level GitHub permission is computed as:

```text
final_perm = max(direct_collaborator_perm, team_derived_perm)
```

Permission order:

```text
admin > maintain > write > triage > read
```

## Team Mapping

Team relationships are integrated through:

- repo -> teams
- team -> members
- member -> Claustrum user link

Claustrum resolves project role from GitHub permission through configurable role mapping.

## Partial Recompute via Webhooks

Webhook processing targets only impacted repositories.

- `installation_repositories`: sync changed repos and recompute changed scope.
- `team` / `membership`: recompute repos affected by the team.
- `repository` rename: metadata refresh; permission recompute is optional.
- `team_add` / `team_remove`: invalidate affected cache and recompute affected repo.

## Cache Strategy

Claustrum caches GitHub graph slices for performance.

- `github_repo_teams_cache`
- `github_team_members_cache`
- `github_permission_cache`

Rules:

- Use TTL for normal reads.
- Invalidate by event scope on webhook updates.
- Overwrite or rebuild permission cache on recompute.

## Sync Modes

| Mode | Behavior |
|---|---|
| `add_only` | Adds/upgrades roles. Does not remove stale access. |
| `add_and_remove` | Adds, upgrades, or removes roles to match GitHub, while keeping protection rules. |

## Operations Tips

### Large Organizations and Rate Limits

- Use partial recompute instead of full recompute whenever possible.
- Use cache TTL tuned to event volume.
- Batch manual sync by repo subsets.

### Permission Debugging Checklist

1. Confirm installation is connected to the target workspace.
2. Confirm repo is synced and linked to a project.
3. Confirm GitHub user link exists for the Claustrum user.
4. Inspect permission preview for direct/team max result.
5. Inspect webhook delivery status and recompute audit logs.
