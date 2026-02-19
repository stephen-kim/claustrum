# Integración con Notion

## Objetivo

Usar Notion como fuente externa de contexto para flujos de IA.

- buscar y leer documentación durante sesiones de trabajo
- opcionalmente escribir resúmenes al hacer merge

## Qué necesitas

- token de integración de Notion
- páginas o bases compartidas con esa integración
- `workspace_key` (ejemplo: `personal`)

## Variables de entorno (fallback)

- `MEMORY_CORE_NOTION_TOKEN`
- `MEMORY_CORE_NOTION_DEFAULT_PARENT_PAGE_ID`
- `MEMORY_CORE_NOTION_WRITE_ENABLED`

## Configuración paso a paso

1. Crea una integración interna y copia el token.
2. Guarda la integración en Admin UI (Integrations -> Notion).
   - `enabled=true`
   - `token`
   - `default_parent_page_id` (opcional)
   - `write_enabled` (si usarás escritura)
3. (Opcional) Guarda por API.
4. Valida con `/v1/notion/search` y `/v1/notion/read`.
5. Valida MCP tools:
   - `notion_search`
   - `notion_read`
   - `notion_context`

## Endpoints principales

- `GET /v1/notion/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/notion/read?workspace_key=<ws>&page_id=<id-or-url>&max_chars=4000`
- `POST /v1/notion/write` (solo admin)

## Permisos y auditoría

- read/search: workspace member+
- write: workspace admin + `write_enabled=true`
- audit:
  - `notion.search`
  - `notion.read`
  - `notion.write`

## Recomendación operativa

Para write-back, conviene priorizar flujo en CI (merge-based) frente a hooks locales:

- runtime más consistente
- secretos centralizados
- menos fallos por entorno local

## Prioridad entre ENV y panel de administración

- por defecto, manda Admin UI (DB)
- `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=notion` fuerza modo ENV

## Solución de problemas

- error en search/read: revisa token y permisos de la página
- write falla: revisa rol admin + `write_enabled=true`
- merge write no dispara: revisa `write_on_merge` y pipeline

Última actualización: 2026-02-19
