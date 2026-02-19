# Idiomas outbound y ajuste de prompts

## Política

- Admin UI permanece en inglés.
- Los registros en DB se mantienen neutrales en idioma (`action`, `target`, metadata).
- Locale y tuning de plantillas se aplican solo a integraciónes outbound (Slack/Jira/Confluence/Notion/Webhook/Email).

## Orden de resolución de locale

1. override en request (`locale`)
2. `locale_default` de la política de integración
3. `default_outbound_locale` del workspace
4. fallback final `en`

El filtro de `supported_locales` aplica tanto a nivel workspace como integración.

## API

- `GET /v1/workspaces/:key/outbound-settings`
- `PUT /v1/workspaces/:key/outbound-settings`
- `GET /v1/outbound-policies/:integration_type?workspace_key=...`
- `PUT /v1/outbound-policies/:integration_type`
- `POST /v1/outbound/render`
- `GET /v1/outbound/template-variables?workspace_key=...&integration_type=...`

## Template override (Liquid)

```json
{
  "raw.search": {
    "en": "Searched raw logs for \"{{ q }}\" ({{ count }} results).",
    "ko": "원문 로그에서 \"{{ q }}\"를 검색했습니다. (결과 {{ count }}개)"
  }
}
```

Reglas:
- motor fijo: Liquid
- override tiene prioridad sobre template base
- locale faltante -> fallback a `en`
- action key faltante -> mensaje genérico seguro

Admin UI muestra catálogo de variables (comunes + por acción) para evitar adivinar parámetros runtime.
