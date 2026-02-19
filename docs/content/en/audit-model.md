# Audit Model

Last Updated: February 17, 2026

## Principles

- Audit is append-only by default.
- Mutation (`UPDATE`/`DELETE`) is blocked at DB level.
- Correlation IDs group related events from one operation.
- Export is admin-only and is itself audited.

## Append-Only Enforcement

Claustrum enforces append-only behavior in Postgres with a trigger on `audit_logs`.

- Allowed: `INSERT`
- Blocked: `UPDATE`, `DELETE`
- Exception path: retention maintenance transaction sets `claustrum.audit_maintenance=on`

This keeps regular app paths immutable while still allowing controlled retention operations.

## Event Taxonomy

Access-related keys:

- `access.workspace_member.added`
- `access.workspace_member.role_changed`
- `access.workspace_member.removed`
- `access.project_member.added`
- `access.project_member.role_changed`
- `access.project_member.removed`

Operational keys:

- `audit.export`
- `audit.retention.run`

## Correlation ID

`audit_logs.correlation_id` is used for batch-level traceability.

Typical producers:

- GitHub webhook delivery (`delivery_id`)
- GitHub permission sync job id
- OIDC sync transaction id
- Bulk role change operation id

## Export

Endpoint:

- `GET /v1/audit/export`

Supports:

- `format=csv|json`
- `workspace_key` required
- optional `project_key`, `source`, `action`, `from`, `to`

Behavior:

- Streams output for large datasets
- Requires workspace admin
- Writes `audit.export` event

## Admin UI

Access Timeline supports:

- source/action/project/user/date filters
- correlation-based grouping (`Batch change (X events)`)
- expandable event details (`params`, `evidence`, `correlation_id`)
- CSV/JSON export
