# Auth and Roles

Claustrum uses API key authentication mapped to user identity, then enforces workspace/project role checks.

## Role model

### Workspace roles
- `owner`
- `admin`
- `member`

### Project roles
- `owner`
- `maintainer`
- `writer`
- `reader`

Workspace `owner/admin` can override project membership checks inside the same workspace for operational recovery.

## Authorization map

| Action | Minimum role |
| --- | --- |
| List workspace members | workspace `member` |
| Manage workspace members | workspace `admin` |
| Create/list projects | workspace `member` |
| List project members | project `reader` |
| Manage project members | project `maintainer` |
| Create memory | project `writer` |
| Read memories | project `reader` |
| Confirm/reject decision | project `maintainer` |
| Raw search / raw view | project role from `raw_access_min_role` (default `writer`) |

## Raw access policy

- `workspace_settings.raw_access_min_role` controls minimum project role for `/v1/raw/search` and `/v1/raw/messages/:id`.
- Default is `WRITER`.
- Every raw access request is audited (`raw.search`, `raw.view`).

## Auditing

Important actions always create `audit_logs` entries:
- `memory.create`
- `memory.update`
- `memory.delete`
- `decision.confirm`
- `decision.reject`
- member and API key management actions

Use `/v1/audit-logs` filters:
- `workspace_key` (required)
- `project_key`
- `action_key` (exact)
- `action_prefix`
- `actor_user_id`
- `limit`
