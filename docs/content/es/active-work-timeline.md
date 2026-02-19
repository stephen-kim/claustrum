# Línea de tiempo de Active Work

Toda transición relevante de Active Work queda registrada como evento inmutable.

## Registro de eventos

Tabla: `active_work_events`

Tipos:

- `created`
- `updated`
- `stale_marked`
- `stale_cleared`
- `confirmed`
- `closed`
- `reopened`

Cada evento puede incluir:

- detalle de score/evidence
- estado anterior vs nuevo
- `correlation_id` opcional

## API

- `GET /v1/projects/:key/active-work`
- `GET /v1/projects/:key/active-work/events`
- `POST /v1/active-work/:id/confirm`
- `POST /v1/active-work/:id/close`
- `POST /v1/active-work/:id/reopen`

## Panel de administración

En Context Debug puedes revisar:

- lista actual de active work
- estado stale/closed
- timeline de eventos con JSON
- acciones manuales (maintainer+)

Las acciones manuales quedan auditadas:

- `active_work.manual_confirm`
- `active_work.manual_close`
- `active_work.manual_reopen`

Última actualización: 2026-02-19
