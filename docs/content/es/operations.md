# Guía de operaciónes

## Recuperación base

- `recall` por defecto consulta solo `memories`.
- Los datos raw se mantienen separados del flujo normal.
- `búsqueda raw` devuelve snippets, no texto completo.

## Flujo de importación raw

1. `POST /v1/imports`
2. `POST /v1/imports/:id/parse`
3. `POST /v1/imports/:id/extract`
4. `POST /v1/imports/:id/commit`

Ruta de datos:

- `imports` → `raw_sessions/raw_messages` → `staged_memories` → `memories`

## Resolución de proyecto

Prioridad por defecto:

1. `github_remote`
2. `repo_root_slug`
3. `manual`

Configurable por workspace:

- `resolution_order`
- `auto_create_project`
- prefijo de `project_key`
- `project_mappings`

## Política de auto-switch

`ensureContext()` corre antes de `remember`, `recall` y `search_raw`.

- `auto_switch_repo=true` (por defecto)
- `auto_switch_subproject=false` (por defecto)
- con `pin_mode=true`, no hay cambio automático

## Eventos de CI

- Endpoint: `POST /v1/ci-events`
- Eventos: `ci.success`, `ci.failure`

## Comandos útiles

```shell
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm test:workspace
```
