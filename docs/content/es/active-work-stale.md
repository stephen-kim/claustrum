# Estado obsoleto y cierre automático de Active Work

Active Work se infiere desde señales recientes y se recalcula periódicamente.

## Campos clave

`active_work` incluye:

- `stale` / `stale_reason`
- `last_evidence_at`
- `status` (`inferred` | `confirmed` | `closed`)
- `closed_at`

## Política por workspace

Se configura en Workspace Settings:

- `active_work_stale_days` (default: `14`)
- `active_work_auto_close_enabled` (default: `false`)
- `active_work_auto_close_days` (default: `45`)

## Reglas

- Si `last_evidence_at` supera `stale_days`, se marca como stale.
- Si auto-close está activo y el ítem permanece stale más de `auto_close_days`, se cierra el ítem inferido.
- Los ítems confirmados no se autocerran por defecto.

## Disparadores

- Manual: `POST /v1/projects/:key/recálculo-active-work`
- Programado: job nocturno de recálculo

Última actualización: 2026-02-19
