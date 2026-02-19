# Webhooks de GitHub

Automatiza la sincronización y el recálculo solo en el alcance afectado por eventos de GitHub.

## Comportamiento

- recibe eventos en `POST /v1/webhooks/github`
- valida firma (`X-Hub-Signature-256`)
- deduplica por `delivery_id`
- encola y responde `200` rápidamente
- procesa en worker asíncrono

## Eventos principales

- `installation_repositories`
  - repo sync
  - recálculo de permisos en repos afectados
- `team` / `membership`
  - aplica team mappings
- `repository` rename
  - actualiza metadata de repo links

## Seguridad

- secreto: `GITHUB_APP_WEBHOOK_SECRET`
- firma inválida: rechazo antes de encolar
- reintentos: máximo 3

## Panel de administración

Ruta: **Workspace -> Integrations -> GitHub**

- toggle de webhook
- sync mode
- tabla de deliveries recientes

## Solución de problemas rápida

1. verifica el secret
2. verifica que la installation esté conectada
3. verifica team mappings y user links

Última actualización: 2026-02-19
