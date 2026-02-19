# Security Taxonomy

Claustrum separates security-relevant audit traffic from general operational audit traffic.

## Security Action Scope

Security stream includes:

- `auth.*`
- `access.*`
- `api_key.*`
- `raw.search`
- `raw.view`
- `audit.export`
- `oidc.*`
- `github.permissions.*`
- `security.*`

## Category Mapping

- `auth.*`, `oidc.*` → `auth`
- `access.*`, `github.permissions.*`, `security.*` → `access`
- `raw.search`, `raw.view`, `audit.export` → `data`
- `api_key.*` → `config`

## Severity Mapping

Default severity:

- `high`: `api_key.*`, `audit.export`, `security.*`, auth failures/revokes
- `medium`: `auth.*`, `access.*`, `raw.search`, `raw.view`, `oidc.*`, `github.permissions.*`
- `low`: fallback

`audit_logs.target` may explicitly override:

```json
{
  "category": "auth",
  "severity": "high"
}
```

## Workspace Controls

`workspace_settings`:

- `security_stream_enabled` (default `true`)
- `security_stream_sink_id` (optional dedicated sink)
- `security_stream_min_severity` (`low|medium|high`, default `medium`)

If no dedicated sink is set, Claustrum falls back to enabled security-capable sinks.

Last Updated: 2026-02-17
