# Cálculo de permisos de GitHub

Este documento explica cómo Claustrum calcula permisos efectivos a partir de GitHub.

## Regla de cálculo

El permiso final se calcula así:

```text
final_permission = max(direct collaborator permission, team-derived permissions)
```

Orden de prioridad:

```text
admin > maintain > write > triage > read
```

## Datos utilizados

Para cada repo vinculado:

1. direct collaborators
2. repo teams
3. team members

El permiso de equipo se expande por usuario y luego se fusiona con direct collaborator usando la regla `max`.

## Caché

Configuración:

- `github_cache_ttl_seconds` (default: 900)

Tablas de caché:

- `github_repo_teams_cache`
- `github_team_members_cache`
- `github_permission_cache`

Comportamiento:

- caché fresca: reutiliza
- caché vencida/faltante: consulta otra vez GitHub API
- sync en best-effort con reintentos limitados

## Modo de sincronización

### `add_only`

- agrega miembros faltantes
- aplica upgrades necesarios
- no elimina ni degrada

### `add_and_remove`

- alinea add/update/remove con GitHub
- mantiene reglas de protección owner/admin
- remoción solo en repos con cálculo exitoso

## APIs relacionadas

- `POST /v1/workspaces/:key/github/sync-permissions`
- `GET /v1/workspaces/:key/github/permission-preview?repo=owner/repo`
- `GET /v1/workspaces/:key/github/cache-status`
