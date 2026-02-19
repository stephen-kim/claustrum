# Proyectos automáticos de GitHub

## Objetivo

Mapear automáticamente repositorios sincronizados de GitHub a proyectos de Claustrum por workspace.

- La sincronización siempre guarda repos en `github_repo_links`.
- La creación automática de proyectos de repo depende de `github_auto_create_projects`.
- La creación automática de subproyectos depende de `github_auto_create_subprojects` (solo en modos split).

## Reglas de clave de proyecto

- Repo key: `{github_project_key_prefix}{owner}/{repo}`
- Subproject key (split): `{github_project_key_prefix}{owner}/{repo}#{subpath}`

Ejemplos:

- `github:acme/platform`
- `github:acme/platform#apps/admin-ui`

## Compartido vs dividido

- `shared_repo` (default)
  - proyecto activo a nivel repo
  - subpath en `metadata.subpath`
  - recall/search puede priorizar coincidencias con `current_subpath`

- `split_on_demand`
  - separa solo subpaths listados en `monorepo_subproject_policies`
  - subpaths no listados vuelven al proyecto de repo

- `split_auto`
  - puede resolver automáticamente como `repo#subpath`
  - si no hay auto-create, fallback al proyecto de repo

## Comportamiento de sync (`POST /v1/workspaces/:key/github/sync-repos`)

1. Obtener repos desde la instalación de GitHub App.
2. Upsert en `github_repo_links`.
3. Si `github_auto_create_projects=true`:
   - upsert del proyecto repo-level
   - garantizar `project_mappings(kind=github_remote, external_id=owner/repo)`
   - conectar `github_repo_links.linked_project_id` con ese proyecto
4. En esta fase no se crean subproyectos.

## Comportamiento del resolver (`POST /v1/resolve-project`)

- `shared_repo`:
  - siempre resuelve al proyecto de repo
- `split_on_demand`:
  - si hay subpath + policy, usa `repo#subpath`
  - si no, fallback al repo-level
- `split_auto`:
  - intenta `repo#subpath`
  - si falta project/mapping:
    - crea solo con `github_auto_create_subprojects=true`
    - si no, fallback al repo-level

## Protecciones de subpath

- normalizar barras y mayúsculas/minúsculas
- reemplazar espacios/caracteres inválidos por `-`
- eliminar segmentos vacíos
- respetar `monorepo_max_depth`
- excluir `node_modules`, `.git`, `dist`, `build`, `.next`

## Eventos de auditoría

- `github.repos.synced`
- `github.projects.auto_created`
- `github.projects.auto_linked`

Última actualización: 2026-02-19
