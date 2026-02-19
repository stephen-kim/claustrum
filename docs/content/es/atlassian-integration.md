# Integración con Atlassian (Jira + Confluence)

## Objetivo

Usar Jira y Confluence como fuentes externas de contexto dentro de los flujos MCP.

- Jira: buscar y leer contexto de issues
- Confluence: buscar y leer documentación
- ambos con enfoque read-first y trazabilidad en auditoría

## Qué necesitas

- URL de Atlassian Cloud (ejemplo: `https://tu-org.atlassian.net`)
- email de cuenta Atlassian
- API token de Atlassian
- `workspace_key` en memory-core (ejemplo: `personal`)

## Variables de entorno (fallback)

Jira:

- `MEMORY_CORE_JIRA_BASE_URL`
- `MEMORY_CORE_JIRA_EMAIL`
- `MEMORY_CORE_JIRA_API_TOKEN`

Confluence:

- `MEMORY_CORE_CONFLUENCE_BASE_URL`
- `MEMORY_CORE_CONFLUENCE_EMAIL`
- `MEMORY_CORE_CONFLUENCE_API_TOKEN`

## Configuración paso a paso

1. Genera un API token en Atlassian.
2. Guarda la integración en Admin UI (Integrations).
   - `enabled=true`
   - `base_url`, `email`, `api_token`
3. (Opcional) Guarda la misma configuración vía API.
4. Valida con `/v1/jira/search` y `/v1/confluence/search`.
5. Valida en MCP:
   - `jira_search`, `jira_read`
   - `confluence_search`, `confluence_read`

## Endpoints principales

Jira:

- `GET /v1/jira/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/jira/read?workspace_key=<ws>&issue_key=<ABC-123>&max_chars=4000`

Confluence:

- `GET /v1/confluence/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/confluence/read?workspace_key=<ws>&page_id=<id-or-url>&max_chars=4000`

## Permisos y auditoría

- read/search requiere workspace member+
- eventos audit:
  - `jira.search`
  - `jira.read`
  - `confluence.search`
  - `confluence.read`

## Prioridad entre ENV y panel de administración

- por defecto, manda la configuración guardada en Admin UI (DB)
- `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=jira,confluence` fuerza modo ENV

## Solución de problemas

- `Invalid API key`: revisa token y cabecera Authorization
- `Integration not configured`: revisa configuración por workspace
- search funciona pero read falla: revisa permisos en Atlassian

Última actualización: 2026-02-19
