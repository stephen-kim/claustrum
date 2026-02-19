# API de Context Bundle

Context Bundle estandariza el contexto para que Codex, Claude, Cursor y otros clientes consuman exactamente el mismo formato.

## Endpoint principal

- `GET /v1/context/bundle`

## Parámetros de consulta

- `workspace_key` (requerido)
- `project_key` (requerido)
- `q` (opcional)
- `current_subpath` (opcional)
- `mode=default|debug` (opcional)
- `budget` (opcional)

## Qué devuelve

- `project`: datos del proyecto
- `snapshot`: summary, decisions, constraints, active_work, recent_activity
- `retrieval`: resultados de búsqueda
- `global`: reglas globales de workspace/usuario
- `debug` (solo en `mode=debug`): desglose de score, boosts y presupuesto

## Reglas importantes

- Devuelve texto corto y curado para contexto.
- No incluye contenido raw completo.
- Para raw usa solo referencias (`evidence_ref`).

## Uso desde MCP

`mcp-adapter` puede llamar este endpoint con `context_bundle()` antes de `recall`/`remember`.

Última actualización: 2026-02-19
