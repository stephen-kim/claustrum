# Taxonomía de seguridad

Claustrum separa eventos de seguridad de la auditoría operativa general.

## Qué entra al Security Stream

- `auth.*`
- `access.*`
- `api_key.*`
- `raw.search`
- `raw.view`
- `audit.export`
- `oidc.*`
- `github.permissions.*`
- `security.*`

## Mapeo de categoría

- `auth.*`, `oidc.*` -> `auth`
- `access.*`, `github.permissions.*`, `security.*` -> `access`
- `raw.search`, `raw.view`, `audit.export` -> `data`
- `api_key.*` -> `config`

## Mapeo de severidad

Default:

- `high`: `api_key.*`, `audit.export`, `security.*`, fallos/revocaciones de auth
- `medium`: `auth.*`, `access.*`, `raw.search`, `raw.view`, `oidc.*`, `github.permissions.*`
- `low`: fallback

Puedes sobreescribir por evento:

```json
{
  "category": "auth",
  "severity": "high"
}
```

## Controles por workspace

- `security_stream_enabled` (default: `true`)
- `security_stream_sink_id` (sink dedicado, opcional)
- `security_stream_min_severity` (`low|medium|high`, default: `medium`)

Si no hay sink dedicado, se usan sinks de seguridad habilitados.
