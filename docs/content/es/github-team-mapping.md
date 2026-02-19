# Mapeo de equipos de GitHub

## Objetivo

GitHub Team Mapping conecta membresías de equipos de GitHub con roles de Claustrum a nivel workspace o proyecto.

Se activa por webhooks (`team`, `membership`) y respeta estas políticas:

- `github_team_mapping_enabled`
- `github_webhook_sync_mode` (`add_only` / `add_and_remove`)

## Modelo de datos

Campos clave de `github_team_mappings`:

- `workspace_id`
- `provider_installation_id` (opcional)
- `github_team_id`, `github_team_slug`, `github_org_login`
- `target_type` (`workspace` | `project`)
- `target_key`
- `role`
- `priority`, `enabled`

## Comportamiento por modo

### add_only

- añade miembros faltantes
- actualiza rol si corresponde uno superior
- no elimina miembros existentes

### add_and_remove

- añade/actualiza para reflejar el mapeo actual
- elimina miembros vinculados que salieron del alcance
- mantiene protecciones de owner/admin

## Roles recomendados

- Workspace target: `OWNER` / `ADMIN` / `MEMBER`
- Project target: `OWNER` / `MAINTAINER` / `WRITER` / `READER`

## Ejemplos

### Ejemplo 1: platform team -> project maintainers

- Team: `acme/platform-team` (`github_team_id=42`)
- Target: `project`
- Target key: `github:acme/platform`
- Role: `MAINTAINER`

Resultado: los usuarios vinculados de `platform-team` mantienen rol maintainer en `github:acme/platform`.

### Ejemplo 2: security team -> workspace admins

- Team: `acme/security` (`github_team_id=77`)
- Target: `workspace`
- Target key: `team-alpha`
- Role: `ADMIN`

Resultado: los usuarios vinculados de `security` pasan a ser admins de `team-alpha`.

## Panel de administración

Ruta: **Workspace -> Integrations -> GitHub -> GitHub Team Mappings**

Acciones:

- crear mapping
- activar/desactivar
- eliminar mapping

Inputs:

- org login, team slug, team id
- target type/key
- role
- priority

Última actualización: 2026-02-19
