# Integración de auditoría con Slack

## Objetivo

Enviar eventos de auditoría a Slack para que el equipo vea rápido:

- quién cambió algo
- qué se cambió
- por qué se cambió

Es una integración de notificación saliente (no expone herramientas MCP de lectura).

## Qué necesitas

- URL de Slack Incoming Webhook
- `workspace_key` (ejemplo: `personal`)

## Variables de entorno (fallback)

- `MEMORY_CORE_AUDIT_SLACK_WEBHOOK_URL`
- `MEMORY_CORE_AUDIT_SLACK_ACTION_PREFIXES`
- `MEMORY_CORE_AUDIT_SLACK_DEFAULT_CHANNEL`
- `MEMORY_CORE_AUDIT_SLACK_FORMAT`
- `MEMORY_CORE_AUDIT_SLACK_INCLUDE_TARGET_JSON`
- `MEMORY_CORE_AUDIT_SLACK_MASK_SECRETS`

## Configuración paso a paso

1. Crea un webhook en Slack.
2. Guarda la integración en Admin UI (Integrations -> Slack Audit).
   - `enabled=true`
   - `webhook_url`
   - opcionales: `default_channel`, `action_prefixes`, `format`, `routes`, `severity_rules`
3. (Opcional) Guarda vía API.
4. Ejecuta una acción auditada y comprueba que llegue el mensaje.

## Campos útiles

- `webhook_url`
- `default_channel`
- `action_prefixes`
- `format` (`detailed` / `compact`)
- `include_target_json`
- `mask_secrets`
- `routes`
- `severity_rules`

## Prioridad entre ENV y panel de administración

- por defecto, manda Admin UI (DB)
- `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=slack` fuerza modo ENV

## Solución de problemas

- no llega mensaje: revisa webhook + `enabled=true` + filtros
- error de provider locked: revisa política de lock de integración

Última actualización: 2026-02-19
