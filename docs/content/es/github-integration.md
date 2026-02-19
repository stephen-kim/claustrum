# Integración de GitHub (ámbito por workspace)

## Alcance

Esta página cubre la base de la integración con GitHub:

- conectar una instalación de GitHub App a un workspace
- sincronizar inventario de repositorios
- mantener metadatos para enlace de proyectos y sincronización de permisos

Ver también:

- [GitHub Auto Projects](github-auto-projects)
- [GitHub Permission Sync](github-permission-sync)
- [GitHub Webhooks](github-webhooks)

## Modelo por workspace

Cada workspace admite **0 o 1** instalación de GitHub App.

- `github_installations`: metadatos de instalación
- `github_repo_links`: caché de repos sincronizados

## Variables de entorno

Requeridas:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`

Opcionales:

- `GITHUB_APP_WEBHOOK_SECRET` (necesaria si activas webhooks)
- `GITHUB_APP_NAME`, `GITHUB_APP_URL`
- `MEMORY_CORE_GITHUB_STATE_SECRET`

`GITHUB_APP_PRIVATE_KEY` admite:

- PEM directo
- PEM con saltos escapados (`\n`)
- PEM en base64

## Flujo de instalación

1. Admin UI solicita la install URL.
2. El admin abre la URL de instalación en GitHub.
3. GitHub llama al callback con `installation_id` y `state`.
4. memory-core valida `state` + permisos admin y hace upsert en `github_installations`.

## Endpoints principales

- `GET /v1/workspaces/:key/github/install-url`
  - auth: workspace admin+

- `GET /v1/auth/github/callback?installation_id=...&state=...`
  - valida state firmado
  - upsert en `github_installations`
  - audit: `github.installation.connected`

- `POST /v1/workspaces/:key/github/sync-repos`
  - auth: workspace admin+
  - usa token de instalación de vida corta (no persistido)
  - upsert en `github_repo_links`
  - audit: `github.repos.synced`

- `GET /v1/workspaces/:key/github/repos`
  - auth: workspace member+
  - devuelve repos activos en caché

- `GET /v1/workspaces/:key/github/installation`
  - auth: workspace member+
  - estado de conexión para Admin UI

## Notas de seguridad

- El installation token es temporal y no se guarda en DB.
- El `state` del callback va firmado y con expiración.
- El callback revalida que el actor tenga rol admin/owner.
- La private key se usa solo en el servidor.

Última actualización: 2026-02-19
