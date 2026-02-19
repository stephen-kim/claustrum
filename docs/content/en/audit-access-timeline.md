# Audit Access Timeline


## Purpose

Claustrum standardizes access-change auditing so admins can answer:

- Who changed access?
- What changed (add / role change / remove)?
- Why did it change (manual action, GitHub sync, OIDC mapping, or system process)?
- Which batch/job/webhook caused it?

This page documents the event categories and Access Timeline UI behavior.

## Action Key Taxonomy

Workspace membership events:

- `access.workspace_member.added`
- `access.workspace_member.role_changed`
- `access.workspace_member.removed`

Project membership events:

- `access.project_member.added`
- `access.project_member.role_changed`
- `access.project_member.removed`

These are emitted for:

- Manual admin/member changes (`source: "manual"`)
- GitHub permission sync / team mapping updates (`source: "github"`)
- OIDC group mapping changes (`source: "oidc"`)
- System-driven flows (`source: "system"`)

## Standard `params` Contract

Each access audit event includes at least:

- `source`: `manual | github | oidc | system`
- `target_user_id`
- `old_role` (nullable for added)
- `new_role` (nullable for removed)
- `workspace_key`
- `project_key` (project events only)
- `correlation_id` (optional but recommended)
- `evidence` (optional json object)

Example (role change):

```json
{
  "source": "github",
  "target_user_id": "usr_123",
  "old_role": "READER",
  "new_role": "WRITER",
  "workspace_key": "acme",
  "project_key": "github:acme/platform",
  "correlation_id": "gh-delivery-6fd9...",
  "evidence": {
    "repo": "acme/platform",
    "team": "backend",
    "permission": "write"
  }
}
```

## Correlation ID Usage

Use `correlation_id` to group bulk updates from a single operation.

Recommended values:

- GitHub webhook delivery id
- Permission sync job id
- OIDC sync transaction id

In Access Timeline UI, events with the same `correlation_id` can be inspected together as one batch.

## Access Timeline API

Endpoint:

- `GET /v1/audit/access-timeline`

Query:

- `workspace_key` (required)
- `project_key` (optional)
- `user_id` (optional, target user)
- `source` (optional)
- `action` (optional: `add | change | remove`)
- `from`, `to` (optional ISO datetime)
- `limit`, `cursor` (pagination)

Response:

- `items[]` with standardized access events
- `next_cursor` for pagination

## Admin UI Filters

Admin Console -> Audit Logs -> Access Timeline supports:

- Project filter
- Target user filter
- Source filter (`manual/github/oidc/system`)
- Action filter (`add/change/remove`)
- Date range (`from`, `to`)
- Cursor pagination (`Load more`)

Each row shows:

- Timestamp
- Human-readable summary
- Source badge
- Actor (`actor_user_id` or `system_actor`)
- Expandable details (`params`, `correlation_id`, `evidence`)
- Copy JSON action

## Operational Guidance

- Use `source=github` + `correlation_id` during webhook incidents.
- Use `source=oidc` when validating IdP group mapping effects.
- Use `user_id` filter for user-specific access investigations.
- Prefer `add_only` sync mode when first enabling external authority; move to `add_and_remove` after validation.
