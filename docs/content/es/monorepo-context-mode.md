# Modo de contexto para monorepos

Claustrum permite elegir, por workspace, cómo compartir o separar memoria dentro de un monorepo.

## Modos

### 1) `shared_repo` (default)

- `project_key` activo a nivel repo (`github:org/repo`)
- subpath detectado se guarda en `metadata.subpath`
- recall/search puede aplicar boost con `current_subpath`
- ideal cuando quieres compartir contexto entre subproyectos con menos ruido

### 2) `split_on_demand` (split recomendado)

- separa solo subpaths listados en `monorepo_subproject_policies`
- para subpaths listados usa `github:org/repo#apps/admin-ui`
- subpaths no listados vuelven al repo-level
- útil cuando solo algunas apps/packages necesitan aislamiento

### 3) `split_auto` (avanzado)

- cualquier subpath detectado puede resolverse como `repo#subpath`
- si auto-create está activo, crea subprojects faltantes
- recomendado para monorepos maduros con protecciones bien definidas

## Workspace settings

- `monorepo_context_mode`: `shared_repo` | `split_on_demand` | `split_auto`
- `monorepo_subpath_metadata_enabled`: guarda `metadata.subpath` en shared
- `monorepo_subpath_boost_enabled`: boost por subpath actual en shared
- `monorepo_subpath_boost_weight`: multiplicador (default `1.5`)

## Ejemplos de key

- Shared: `github:acme/claustrum`
- Split: `github:acme/claustrum#apps/memory-core`

## Notas

- el orden de fallback del resolver no cambia: `github_remote > repo_root_slug > manual`
- si falla detección de subpath en modos split, fallback a repo key
- configuración en UI: **Project Resolution Settings -> Monorepo Context**

Última actualización: 2026-02-19
