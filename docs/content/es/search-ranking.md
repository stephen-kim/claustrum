# Ranking de búsqueda (híbrido)

Claustrum usa búsqueda híbrida por defecto: FTS + semantic.

## Recuperación base

- `keyword`: candidatos de Postgres FTS
- `semantic`: similitud de embeddings
- `hybrid`: combinación ponderada de ambos

## Boosts adicionales

- type boost (prioriza decision/constraint, etc.)
- recency boost (favorece información reciente)
- subpath boost (en `shared_repo`, si coincide con subpath actual)

## Fórmula

`final = base_score * type_boost * recency_boost * subpath_boost`

## Ajustes de workspace

- `search_type_weights`
- `search_recency_half_life_days` (default: 14)
- `search_subpath_boost_weight` (default: 1.5)

## Desglose de depuración (`debug=true`)

- `vector`
- `fts`
- `type_boost`
- `recency_boost`
- `subpath_boost`
- `final`

Última actualización: 2026-02-19
