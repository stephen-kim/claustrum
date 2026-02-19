# OIDC SSO

Claustrum supports OIDC login per workspace with provider-managed identity and role sync.

## Identity Model

- User identity key is `(issuer + subject)` from OIDC claims.
- Email is treated as profile data only and may change.
- Identity records are stored in `user_identities`.

## Provider Configuration

Admin UI path:

- Workspace -> **SSO Settings (OIDC)**

Provider fields:

- `issuer_url`
- `client_id`
- `client_secret`
- `claim_groups_name` (default: `groups`)
- `claim_groups_format` (`id` recommended)
- `scopes` (default: `openid profile email`)
- `enabled`

## Login Flow

Endpoints:

- `GET /v1/auth/oidc/:workspace_key/start`
- `GET /v1/auth/oidc/:workspace_key/callback`

Flow:

1. Start endpoint creates PKCE challenge + signed state token.
2. User authenticates in IdP.
3. Callback exchanges code for tokens.
4. `id_token` signature is verified via IdP JWKS.
5. `(issuer, sub)` is upserted to `user_identities`.
6. Group mappings are applied to workspace/project memberships.
7. Session token is issued.

## Group Claim Format

- `id`: Stable group IDs from IdP (recommended).
- `name`: Human-readable names. Renames in IdP can break mapping behavior.

## Provider Examples

### Okta

- Issuer: `https://<your-okta-domain>/oauth2/default`
- Scopes: `openid profile email groups`
- Groups claim: often `groups` (configure in authorization server claims)

### Microsoft Entra ID

- Issuer: `https://login.microsoftonline.com/<tenant-id>/v2.0`
- Scopes: `openid profile email`
- Group claim: configure app manifest for group IDs (recommended)

## Security Notes

- Never use email as stable identity key.
- Use `claim_groups_format=id` whenever possible.
- Keep client secrets rotated and restricted to required redirect URIs.
