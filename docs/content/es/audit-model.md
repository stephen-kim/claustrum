# Modelo de auditoría

El sistema de auditoría de Claustrum prioriza trazabilidad e inmutabilidad.

## Principios

- append-only
- `UPDATE` / `DELETE` bloqueados en DB
- `correlation_id` para agrupar acciones relacionadas
- export también se audita

## Garantía append-only

`audit_logs` solo permite `INSERT`.

## Action keys frecuentes

- `access.workspace_member.*`
- `access.project_member.*`
- `audit.export`
- `audit.retention.run`

## Correlation ID

Permite agrupar eventos de una misma operación, por ejemplo:

- webhook delivery de GitHub
- job de permission sync
- sync de OIDC

## Export

- `GET /v1/audit/export`
- formatos: `csv` y `json`
- requiere workspace admin

Última actualización: 2026-02-19
