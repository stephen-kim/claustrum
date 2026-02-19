# Reglas globales

Global Rules te permite gestionar reglas compartidas del workspace y reglas personales por usuario.

## Alcances

- `workspace`: reglas comunes para todo el equipo
- `user`: reglas personales de cada usuario

## Principios de diseño

- Sin límite rígido tipo “máximo 5”.
- Selección dinámica por token budget + score.
- `pinned=true` y `severity=high` siempre tienen prioridad.
- Si hay demasiadas reglas, se usa resumen (`summary`) como fallback.

## Campos principales

- `title`, `content`
- `category`: `policy | security | style | process | other`
- `priority`: `1..5`
- `severity`: `low | medium | high`
- `pinned`, `enabled`

## API

- `GET /v1/global-rules?workspace_key=...&scope=workspace|user&user_id?`
- `POST /v1/global-rules`
- `PUT /v1/global-rules/:id`
- `DELETE /v1/global-rules/:id`
- `POST /v1/global-rules/summarize`

### Modo de resumen

- `preview`: devuelve solo el resumen
- `replace`: guarda/actualiza en `global_rule_summaries`

## Protecciones suaves

- `global_rules_recommend_max` (default: 5)
- `global_rules_warn_threshold` (default: 10)

Comportamiento:

- sobre recomendado: aviso informativo
- al superar warning threshold: aviso de posible pérdida de claridad

Última actualización: 2026-02-19
