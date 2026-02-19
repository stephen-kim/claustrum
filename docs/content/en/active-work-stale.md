# Active Work Stale and Auto-close

Active Work is inferred from recent project signals and periodically recomputed.

## Key Fields

`active_work` includes:

- `stale` / `stale_reason`
- `last_evidence_at`
- `status` (`inferred` | `confirmed` | `closed`)
- `closed_at`

## Workspace Policy

Configured in Workspace Settings:

- `active_work_stale_days` (default `14`)
- `active_work_auto_close_enabled` (default `false`)
- `active_work_auto_close_days` (default `45`)

## Rules

- If `last_evidence_at` is older than `stale_days`, item is marked stale.
- If auto-close is enabled and item stays stale past `auto_close_days`, inferred items are closed.
- Confirmed items are preserved from auto-close by default.

## Trigger Paths

- Manual: `POST /v1/projects/:key/recompute-active-work`
- Scheduled: nightly recompute job

Last Updated: 2026-02-18
