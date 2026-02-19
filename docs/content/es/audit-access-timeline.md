# Línea de tiempo de accesos

Especifica cómo Claustrum registra y muestra cambios de acceso.

## Objetivo

Responder con evidencia a:
- quién cambió acceso
- qué cambió (add/change/remove)
- por qué cambió (manual/github/oidc/system)
- qué job o webhook lo originó

## Action keys

Workspace:
- `access.workspace_member.added`
- `access.workspace_member.role_changed`
- `access.workspace_member.removed`

Project:
- `access.project_member.added`
- `access.project_member.role_changed`
- `access.project_member.removed`

## Contrato `params`

Campos mínimos:
- `source`
- `target_user_id`
- `old_role`
- `new_role`
- `workspace_key`
- `project_key` (solo project events)
- `correlation_id` (recomendado)
- `evidence` (opcional)

## Correlation ID

Agrupa cambios masivos de una sola operación.

Ejemplos:
- delivery id de webhook GitHub
- id de permission sync job
- id de transacción OIDC

## API

- `GET /v1/audit/access-timeline`

Filtros principales:
- `workspace_key` (required)
- `project_key`
- `user_id`
- `source`
- `action` (`add|change|remove`)
- `from`, `to`
- `limit`, `cursor`

## Filtros en el panel de administración

- project
- target user
- source
- action
- date range
- cursor pagination

Última actualización: 2026-02-19
