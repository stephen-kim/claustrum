# Sincronización de permisos de GitHub

Sincroniza permisos reales de GitHub hacia roles de proyecto en Claustrum.

## Flujo

1. conectar GitHub App installation
2. ejecutar repo sync
3. configurar `github_user_links`
4. ejecutar permission sync (primero en dry-run)

## Modos

### `add_only` (default)

- solo agrega y eleva
- no elimina ni degrada

### `add_and_remove`

- agrega / actualiza / elimina
- remueve usuarios sin permiso vigente
- mantiene protección de owner

## Mapeo por defecto

```json
{
  "admin": "maintainer",
  "maintain": "maintainer",
  "write": "writer",
  "triage": "reader",
  "read": "reader"
}
```

## Unmatched users

Si no existe user link para un usuario de GitHub:

- se cuenta en `skipped_unmatched`
- aparece en preview como unmatched
- no se cambia ningún rol en Claustrum

## APIs

- `GET /v1/workspaces/:key/github/user-links`
- `POST /v1/workspaces/:key/github/user-links`
- `DELETE /v1/workspaces/:key/github/user-links/:userId`
- `POST /v1/workspaces/:key/github/sync-permissions`
- `GET /v1/workspaces/:key/github/permission-status`
- `GET /v1/workspaces/:key/github/permission-preview`
- `GET /v1/workspaces/:key/github/cache-status`
