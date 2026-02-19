# Group Mapping

Claustrum maps IdP groups to workspace/project roles using stable `group_id` values.

## Mapping Record

Each mapping has:

- `provider_id`
- `claim_name` (example: `groups`)
- `group_id` (stable ID)
- `group_display_name` (UI label only)
- `target_type`: `workspace` or `project`
- `target_key`: workspace key or project key
- `role`
- `priority`
- `enabled`

## Role Targets

### Workspace roles

- `OWNER`
- `ADMIN`
- `MEMBER`

### Project roles

- `OWNER`
- `MAINTAINER`
- `WRITER`
- `READER`

## Sync Modes

Configured per workspace (`workspace_settings.oidc_sync_mode`):

- `add_only` (default): add/update mapped access, keep unmatched access
- `add_and_remove`: remove unmatched memberships (owner protection applies)

Owner protection:

- Existing `OWNER` roles are not automatically downgraded/removed.

## Example Mappings

1. Workspace admin mapping

- `group_id = 00gk9abc123xyz`
- `target_type = workspace`
- `target_key = personal`
- `role = ADMIN`

2. Project writer mapping

- `group_id = 00gk9devs123xyz`
- `target_type = project`
- `target_key = github:org/repo#apps/admin-ui`
- `role = WRITER`

## Operational Advice

- Prefer one stable `group_id` source from IdP.
- Use lower priority numbers for stronger/default mappings.
- Keep a small set of high-confidence mappings first, then expand.
