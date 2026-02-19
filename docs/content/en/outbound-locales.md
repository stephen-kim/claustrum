# Outbound Locales and Prompt Tuning


## Policy

- Admin UI is currently available in English.
- Database records remain language-neutral (`action`, `target` params/metadata).
- Locale and prompt tuning apply only to outbound integrations (Slack/Jira/Confluence/Notion/Webhook/Email).


## Locale Resolution

Outbound locale selection order:

1. request override (`locale`)
2. integration policy `locale_default`
3. workspace `default_outbound_locale`
4. fallback `en`

Supported locale filtering applies at both workspace and integration policy levels.


## API

- `GET /v1/workspaces/:key/outbound-settings`
- `PUT /v1/workspaces/:key/outbound-settings`
- `GET /v1/outbound-policies/:integration_type?workspace_key=...`
- `PUT /v1/outbound-policies/:integration_type`
- `POST /v1/outbound/render`
- `GET /v1/outbound/template-variables?workspace_key=...&integration_type=...`


## Template Overrides

`template_overrides` format (Liquid):

```json
{
  "raw.search": {
    "en": "Searched raw logs for \"{{ q }}\" ({{ count }} results).",
    "ko": "원문 로그에서 \"{{ q }}\"를 검색했습니다. (결과 {{ count }}개)"
  }
}
```text

Rules:

- Liquid is the fixed rendering engine for outbound messages.
- Override template wins over built-in template.
- Missing locale falls back to `en`.
- Missing action key falls back to a safe generic sentence.

Admin UI now shows a variable catalog (common + action-specific) so operators can format templates without guessing runtime params.
