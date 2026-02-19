# Mapeo de grupos

El mapeo de grupos conecta grupos del IdP con roles de workspace/proyecto en Claustrum.

## Campos del mapping

- `provider_id`
- `claim_name` (ej: `groups`)
- `group_id` (ID estable)
- `group_display_name` (solo UI)
- `target_type` (`workspace` o `project`)
- `target_key`
- `role`
- `priority`
- `enabled`

## Roles objetivo

### Workspace
- `OWNER`
- `ADMIN`
- `MEMBER`

### Project
- `OWNER`
- `MAINTAINER`
- `WRITER`
- `READER`

## Modo de sincronización

`workspace_settings.oidc_sync_mode`:

- `add_only` (default)
  - agrega/actualiza accesos mapeados
  - conserva accesos no mapeados
- `add_and_remove`
  - también elimina membresías no mapeadas
  - mantiene protección de owner

## Ejemplos

1) Admin de workspace
- `group_id = 00gk9abc123xyz`
- `target_type = workspace`
- `target_key = personal`
- `role = ADMIN`

2) Writer de proyecto
- `group_id = 00gk9devs123xyz`
- `target_type = project`
- `target_key = github:org/repo#apps/admin-ui`
- `role = WRITER`

## Recomendaciones

- Usar IDs estables de grupo
- Empezar con pocos mappings críticos
- Ajustar `priority` para resolver conflictos

Última actualización: 2026-02-19
