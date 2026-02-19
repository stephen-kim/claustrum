# Retención de auditoría

Define cuánto tiempo se conservan audit logs y raw events por workspace.

## Settings

- `retention_policy_enabled` (default: `false`)
- `audit_retention_days` (default: `365`)
- `raw_retention_days` (default: `90`)
- `retention_mode` (`archive` | `hard_delete`, default: `archive`)

## Tratamiento de datos

### raw_events
- se eliminan filas más antiguas que `raw_retention_days`

### audit_logs
- `archive` (recomendado): mover a `audit_logs_archive` y quitar del origen
- `hard_delete`: borrar directamente

## Ejecución

- job diario de retención
- solo workspaces con `retention_policy_enabled=true`
- cada ejecución registra `audit.retention.run`

Campos típicos del evento:
- `retention_mode`
- `audit_retention_days`
- `raw_retention_days`
- `archived_count`
- `deleted_count`
- `raw_deleted_count`

## Recomendaciones

- empezar con `archive`
- en entornos enterprise: 180-365 días de auditoría
- `hard_delete` solo si compliance lo exige

Última actualización: 2026-02-19
