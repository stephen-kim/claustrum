# OIDC SSO

Claustrum soporta login OIDC por workspace.  
OIDC cubre identidad y acceso inicial; GitHub sigue siendo la autoridad principal para permisos de proyecto.

## Modelo de identidad

- clave de identidad: `(issuer, subject)`
- el email es dato de perfil, no clave primaria
- registros en `user_identities`

## Configuración del proveedor

Admin UI:

- Workspace -> **SSO Settings (OIDC)**

Campos clave:

- `issuer_url`
- `client_id`
- `client_secret`
- `claim_groups_name` (default: `groups`)
- `claim_groups_format` (recomendado: `id`)
- `scopes` (default: `openid profile email`)
- `enabled`

## Flujo de login

- `GET /v1/auth/oidc/:workspace_key/start`
- `GET /v1/auth/oidc/:workspace_key/callback`

Secuencia:

1. `start` crea PKCE + state firmado
2. usuario autentica en IdP
3. callback intercambia code por tokens
4. verifica firma de `id_token` vía JWKS
5. upsert de `(issuer, sub)`
6. aplica group mappings
7. emite sesión

## Formato de grupos

- `id`: estable (recomendado)
- `name`: sensible a renombres en IdP

## Ejemplos

### Okta

- Issuer: `https://<your-okta-domain>/oauth2/default`
- Scopes: `openid profile email groups`

### Microsoft Entra ID

- Issuer: `https://login.microsoftonline.com/<tenant-id>/v2.0`
- Scopes: `openid profile email`
- preferir claims de grupo por ID

## Notas de seguridad

- no usar email como clave estable
- preferir `claim_groups_format=id`
- rotar client secrets de forma periódica

Última actualización: 2026-02-19
