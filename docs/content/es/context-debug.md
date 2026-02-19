# Depuración de contexto

Context Debug muestra por qué el bundle devolvió esos resultados.

## Qué puedes revisar

- persona aplicada y persona recomendada
- razones y confidence de la recomendación
- selección de global rule routing
- active work candidates con score breakdown
- score de retrieval (FTS/vector + boosts)
- uso de token budget por sección
- política de active work (`stale_days`, `auto_close`)

## Cómo obtener debug bundle

- `GET /v1/context/bundle?...&mode=debug`

Campos clave:
- `persona_applied`
- `persona_recommended`
- `weight_adjustments`
- `active_work_candidates`
- `active_work_policy`
- `token_budget`

## Overrides manuales

Desde Admin UI:

- aplicar persona recomendada
- confirmar/pinear active work
- cerrar/reabrir active work

Se mantiene explícito para que la automatización sea transparente.

Última actualización: 2026-02-19
