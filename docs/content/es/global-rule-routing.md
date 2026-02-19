# Enrutamiento de reglas globales

Inyectar siempre todas las reglas globales genera ruido.  
Claustrum selecciona reglas dinámicamente según la consulta y el contexto actual.

## Reglas siempre incluidas

- `pinned=true`
- `severity=high`

El resto se selecciona por score.

## Modos de routing

- `semantic`
- `keyword`
- `hybrid` (default)

Configuración principal:

- `global_rules_routing_enabled` (default: `true`)
- `global_rules_routing_mode` (default: `hybrid`)
- `global_rules_routing_top_k` (default: `5`)
- `global_rules_routing_min_score` (default: `0.2`)

## Fórmula (conceptual)

`score = semantic_similarity + keyword_overlap + priority_weight + recency_weight - length_penalty`

## Origen de la query

1. `q` explícita del endpoint
2. si no existe, pseudo-query con summary, active work, recent activity y subpath

## Relación con token budget

- primero ranking por score
- luego recorte por presupuesto
- si no alcanza, fallback a summary

## Dónde verlo en el panel de administración

- Workspace -> Global Rules (configuración)
- Project -> Context Debug (selected/dropped + score)

## Recomendaciones

- `top_k` entre `3` y `8`
- si hay ruido, subir `min_score`
- añadir tags mejora routing por keyword

Última actualización: 2026-02-19
