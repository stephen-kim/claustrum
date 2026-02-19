# Variables de entorno (referencia completa)

Esta página complementa `.env.example`.  
`.env.example` está pensado para arranque rápido; aquí tienes la referencia completa por casos de uso.

## Mínimo para arrancar

- `DATABASE_URL`
- `MEMORY_CORE_API_KEY`
- `MEMORY_CORE_URL`
- `NEXT_PUBLIC_MEMORY_CORE_URL`
- solo con perfil `localdb`: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

## Reglas importantes

- `memory-core` usa **solo** `DATABASE_URL` para la conexión a DB.
- `POSTGRES_*` se usa únicamente para bootstrap de Postgres local.
- Las integraciónes (Notion/Jira/Confluence/Linear/Slack, etc.) pueden configurarse en DB (Admin UI) o por ENV.
- `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS` define qué fuente tiene prioridad.

## Categorías principales

- Runtime core: `MEMORY_CORE_HOST`, `MEMORY_CORE_PORT`, `MEMORY_CORE_LOG_LEVEL`
- Bootstrap/Auth/Seguridad: `MEMORY_CORE_ALLOW_BOOTSTRAP_ADMIN`, `MEMORY_CORE_SECRET`, etc.
- GitHub App: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`
- MCP Adapter: `MEMORY_CORE_URL`, `MEMORY_CORE_API_KEY`, `MEMORY_CORE_WORKSPACE_KEY`
- Admin UI: `NEXT_PUBLIC_MEMORY_CORE_URL`, `ADMIN_UI_PORT`
- Compose: `COMPOSE_PROFILES`, `MEMORY_CORE_IMAGE`, `MCP_ADAPTER_IMAGE`, `ADMIN_UI_IMAGE`

## Política de bloqueo de integraciónes

`MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS`:

- `all`: fuerza ENV para todos los proveedores
- `none`: ignora ENV y usa configuración en DB
- CSV: fuerza ENV solo para proveedores concretos

Ejemplo:

- `notion,jira,confluence,linear,slack,audit_reasoner`

## Recomendaciones operativas

- Mantén `.env.example` corto y claro.
- En `.env`, deja solo valores realmente usados.
- No subas secretos al repositorio.
- En CI, usa GitHub Secrets.

Última actualización: 2026-02-19
