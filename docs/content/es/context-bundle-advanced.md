# Context Bundle: guía avanzada

Esta guía muestra cómo usar el modo debug de Context Bundle para ajustar calidad de contexto.

## Diagnóstico de global routing

En `global.routing` puedes revisar:

- `mode`
- `q_used`
- `selected_rule_ids`
- `dropped_rule_ids`
- `score_breakdown` (solo debug)

## Flujo de depuración

1. Abrir Context Debug en Admin UI
2. Definir query y subpath (opcional)
3. Cargar bundle en modo debug
4. Comparar:

- `retrieval.results[*].score_breakdown`
- `global.routing.score_breakdown`

## Ajustes típicos

- Se caen reglas importantes: bajar `min_score` o subir `top_k`
- Entra mucho ruido: subir `min_score`, mejorar tags o bajar `top_k`
- Presión de presupuesto: reducir reglas pinned y usar summary

## Notas

- El raw completo no se devuelve en bundle
- La info de routing debug es explicativa; no cambia autorización

Última actualización: 2026-02-19
