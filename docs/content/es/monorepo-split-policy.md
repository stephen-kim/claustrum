# Política de separación en monorepo

## Modos disponibles

`monorepo_context_mode` soporta 3 modos:

1. `shared_repo` (default)
2. `split_on_demand`
3. `split_auto` (advanced)

## Comparativa rápida

### `shared_repo`

- project key activo en repo-level (`github:owner/repo`)
- subpath como metadata para ranking/boost
- menor costo operativo

### `split_on_demand`

- separa solo subpaths listados explícitamente
- usa `monorepo_subproject_policies`
- subpaths no listados quedan en repo-level
- estrategia recomendada para producción

### `split_auto`

- puede crear/usar `repo#subpath` automáticamente con protecciones
- más agresivo y cómodo, pero puede generar más proyectos
- no activarlo salvo que el equipo quiera aislamiento automático

## Por qué `split_on_demand` es la estrategia recomendada

- evita explosión de proyectos en monorepos grandes
- da control explícito a admins sobre límites
- mantiene contexto compartido donde no hace falta separar

## Guía operativa

1. empezar con `shared_repo`
2. pasar a `split_on_demand` cuando haya subpaths concretos a aislar
3. añadir policies solo para esos subpaths
4. usar `split_auto` solo si tu flujo tolera expansión automática

## Tabla de políticas

`monorepo_subproject_policies`:

- `workspace_id`
- `repo_key`
- `subpath`
- `enabled`

En `split_on_demand` solo se consideran filas habilitadas.

## Resumen del resolver

- `shared_repo`:
  - active project = `repo_key`
- `split_on_demand`:
  - si `(repo_key, subpath)` está habilitado -> `repo_key#subpath`
  - si no -> `repo_key`
- `split_auto`:
  - aplica split automático con protecciones existentes

## Manejo de rename

El aliasing automático para rename de repo/subpath está planificado como trabajo futuro.  
Mientras tanto, mantén entradas antiguas temporalmente y migra por etapas.

Última actualización: 2026-02-19
