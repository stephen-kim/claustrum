# API Keys and Security

Claustrum uses user-scoped API keys for team onboarding and service access.

## Security model

- API key plaintext is never stored in the database.
- Only `api_keys.key_hash` is stored (HMAC-SHA256 with server secret).
- Admins cannot retrieve existing plaintext keys.
- Users generate their own keys.
- Admins can revoke keys and force reset.
- Reset returns a one-time view link (15-minute TTL by default).

## API flow

### 1) Self-issue key

- `POST /v1/api-keys`
- body: `{ "label": "my-laptop" }` (optional label)
- response includes plaintext once:
  - `{ "id": "...", "label": "...", "api_key": "clst_..." }`

### 2) List keys (metadata only)

- `GET /v1/api-keys` (self)
- `GET /v1/users/:userId/api-keys` (admin/self)
- plaintext is never returned.

### 3) Revoke key

- `POST /v1/api-keys/:id/revoke`
- allowed for key owner or admin.

### 4) Admin reset + one-time link

- `POST /v1/users/:userId/api-keys/reset`
- all active keys for target user are revoked
- a new key is created
- plaintext is not returned directly
- response:
  - `{ "one_time_url": "...", "expires_at": "..." }`

### 5) One-time view endpoint

- `GET /v1/api-keys/one-time/:token`
- valid once only
- expires after TTL
- reused/expired token returns `410 Gone`

## Audit events

Claustrum writes audit logs for key-sensitive actions:

- `api_key.created`
- `api_key.revoked`
- `api_key.reset`
- `api_key.one_time_view`

## Operational recommendations

- Set strong secrets:
  - `MEMORY_CORE_API_KEY_HASH_SECRET`
  - `MEMORY_CORE_ONE_TIME_TOKEN_SECRET`
- Keep one-time token TTL short (`MEMORY_CORE_ONE_TIME_TOKEN_TTL_SECONDS`, default 900).
- Use HTTPS for public base URL when sharing one-time links.
- Rotate compromised keys immediately via revoke/reset.
