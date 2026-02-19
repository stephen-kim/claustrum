# Integración con Linear

## Objetivo

Usar Linear como fuente externa de contexto de issues para MCP.

- buscar issues relevantes
- leer detalle de issue en formato corto
- complementar memoria sin romper el enfoque memory-first

## Qué necesitas

- Linear API key (personal)
- opcional: `api_url` personalizado (default `https://api.linear.app/graphql`)
- `workspace_key` (ejemplo: `personal`)

## Variables de entorno (fallback)

- `MEMORY_CORE_LINEAR_API_KEY`
- `MEMORY_CORE_LINEAR_API_URL`

## Configuración paso a paso

1. Crea un API key en Linear.
2. Guarda la integración en Admin UI (Integrations -> Linear).
   - `enabled=true`
   - `api_key`
   - `api_url` (opcional)
3. (Opcional) Guarda vía API.
4. Valida con `/v1/linear/search` y `/v1/linear/read`.
5. Valida MCP tools:
   - `linear_search`
   - `linear_read`

## Endpoints principales

- `GET /v1/linear/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/linear/read?workspace_key=<ws>&issue_key=<ENG-123>&max_chars=4000`

## Permisos y auditoría

- read/search: workspace member+
- audit:
  - `linear.search`
  - `linear.read`

## Prioridad entre ENV y panel de administración

- por defecto, manda Admin UI (DB)
- `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=linear` fuerza modo ENV

## Solución de problemas

- `Integration not configured`: revisa `api_key` y `enabled=true`
- search funciona y read falla: revisa permisos del token sobre equipo/proyecto

Última actualización: 2026-02-19
