# Security and MCP I/O


## MCP stdio Policy

For MCP servers/adapters:
- `stdout`: JSON-RPC protocol messages only
- `stderr`: logs and errors only

Do not print banners, startup chatter, or migration logs to stdout.


## Raw Data Guardrails

- Raw search returns snippets only.
- Single raw message view is snippet-only.
- `max_chars` limit is enforced.
- No endpoint should return full raw session transcript by default.


## Access Control

- API key auth is required (`Authorization: Bearer <key>`).
- Raw search/view:
  - admin or project member
  - workspace-wide raw search requires workspace admin/owner


## Audit Requirements

Record and review:
- `raw.search`
- `raw.view`

Audit logs should include actor, target, and timestamp.


## Deployment Security Notes

- Use TLS for external DB connections (e.g., `sslmode=require`).
- Rotate API keys.
- Avoid logging secrets in stderr.
