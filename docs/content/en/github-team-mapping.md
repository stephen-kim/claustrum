# GitHub Team Mapping


## Purpose

GitHub Team Mapping links GitHub team membership to Claustrum roles at workspace/project scope.

It is webhook-driven (`team`, `membership` events) and uses workspace-level policies:

- `github_team_mapping_enabled`
- `github_webhook_sync_mode` (`add_only` / `add_and_remove`)


## Data Model

`github_team_mappings` fields:

- `workspace_id`
- `provider_installation_id` (optional)
- `github_team_id`, `github_team_slug`, `github_org_login`
- `target_type` (`workspace` | `project`)
- `target_key`
- `role`
- `priority`, `enabled`


## Mapping Behavior

### add_only

- Adds missing members
- Upgrades role if new role is higher
- Does not remove existing members

### add_and_remove

- Adds/updates members to match mapping
- Removes linked members no longer in mapped team scope
- owner/admin protections remain in place


## Recommended Roles

- Workspace target: `OWNER` / `ADMIN` / `MEMBER`
- Project target: `OWNER` / `MAINTAINER` / `WRITER` / `READER`


## Examples

### Example 1: platform team -> project maintainers

- Team: `acme/platform-team` (`github_team_id=42`)
- Target: `project`
- Target key: `github:acme/platform`
- Role: `MAINTAINER`

Result: linked users in `platform-team` get/keep maintainer rights on `github:acme/platform`.

### Example 2: security team -> workspace admins

- Team: `acme/security` (`github_team_id=77`)
- Target: `workspace`
- Target key: `team-alpha`
- Role: `ADMIN`

Result: linked users in `security` become workspace admins for `team-alpha`.


## Admin UI

Location: **Workspace -> Integrations -> GitHub -> GitHub Team Mappings**

Actions:

- create mapping
- toggle enabled
- remove mapping

Inputs:

- org login, team slug, team id
- target type/key
- role
- priority
