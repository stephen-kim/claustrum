# Authentication Strategy

Claustrum uses a phased authentication model for MCP clients and admin/API operations.

## Phase 1 (Current): API Key

- Auth method: per-user API key (`Authorization: Bearer <api_key>`).
- Key lifecycle:
  - created once and shown once,
  - revocable,
  - admin reset via one-time link.
- Server storage:
  - no plaintext key in DB,
  - `key_hash` only,
  - `key_prefix` for safe display,
  - `device_label` required,
  - optional `expires_at`.
- Scope:
  - API keys are workspace-scoped (`workspace_id`).
  - Cross-workspace access is denied for scoped keys.
- Local MCP adapter storage:
  - `~/.claustrum/state.json`,
  - `chmod 600` enforced on write,
  - warning + auto-tightening if file is too permissive.
- Security behavior:
  - no key/token logging,
  - headers and secrets masked in debug/error output,
  - 401/403 from gateway returns re-login guidance.
- Audit events:
  - `api_key.created`
  - `api_key.revoked`
  - `api_key.reset`
  - `api_key.one_time_view`

## Phase 1 Advantages

- Fast onboarding and simple operations.
- Works across local and remote MCP adapter deployments.
- No dependency on external identity provider for CLI usage.

## Phase 1 Limitations

- Local file plaintext storage (intentional for Phase 1).
- Long-lived key model unless `expires_at` is configured.

## Phase 2 (Planned): Device Flow + Keychain

- OAuth Device Flow for interactive login.
- Short-lived access token + rotating refresh token.
- Refresh token stored in OS keychain (not plaintext file).
- Device-level revoke and session lifecycle controls.
- Backward compatibility:
  - existing API key users continue to work,
  - Device Flow becomes preferred path for new sign-ins.

## Migration Path

1. Keep API key endpoints and audit behavior stable.
2. Add Device Flow endpoints and token exchange.
3. Introduce adapter credential provider abstraction.
4. Move from `state.json` API key to keychain-backed refresh token.
5. Keep fallback API key mode for controlled compatibility windows.
