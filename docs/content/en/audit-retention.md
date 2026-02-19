# Audit Retention

Last Updated: February 17, 2026

## Workspace Settings

Retention is configured per workspace:

- `retention_policy_enabled` (default: `false`)
- `audit_retention_days` (default: `365`)
- `raw_retention_days` (default: `90`)
- `retention_mode` (`archive` | `hard_delete`, default: `archive`)

## Data Handling

### raw_events

- old rows are deleted when older than `raw_retention_days`

### audit_logs

Two modes:

- `archive` (recommended):
  - copy old rows into `audit_logs_archive`
  - remove copied rows from `audit_logs`
- `hard_delete`:
  - remove old rows directly from `audit_logs`

## Job Execution

- memory-core runs a scheduled retention sweep (daily cadence)
- only workspaces with `retention_policy_enabled=true` are processed
- each run emits `audit.retention.run`

`audit.retention.run` params include:

- `retention_mode`
- `audit_retention_days`
- `raw_retention_days`
- `archived_count`
- `deleted_count`
- `raw_deleted_count`

## Operational Guidance

- Start with `archive` mode.
- Keep at least 180-365 days for audit in enterprise environments.
- Use `hard_delete` only where legal/compliance constraints require strict data minimization.
