# Active Work Timeline

Every meaningful Active Work state transition creates an immutable timeline event.

## Event Store

Table: `active_work_events`

Event types:

- `created`
- `updated`
- `stale_marked`
- `stale_cleared`
- `confirmed`
- `closed`
- `reopened`

Each event may contain:

- score/evidence details
- previous vs next status
- optional `correlation_id`

## APIs

- `GET /v1/projects/:key/active-work`
- `GET /v1/projects/:key/active-work/events`
- `POST /v1/active-work/:id/confirm`
- `POST /v1/active-work/:id/close`
- `POST /v1/active-work/:id/reopen`

## Admin UI

Context Debug shows:

- current active work list
- stale/closed state
- event timeline with details JSON
- manual controls (maintainer+)

Manual overrides are audited (`active_work.manual_confirm`, `active_work.manual_close`, `active_work.manual_reopen`).

Last Updated: 2026-02-18
