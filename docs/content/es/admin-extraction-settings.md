# Ajustes de extracción (Admin)

Esta pantalla controla cómo los eventos raw de Git se convierten en `activity` y `decision` memories.

Nota: locale aplica solo a mensajes outbound, no al comportamiento de extracción.

## Dónde se configura

En Admin Console:

- `Project Resolution Settings` -> Extraction Pipeline
- `Decision Keyword Policies`
- `Decisions`

## Ajustes del pipeline

- `enable_activity_auto_log`
  - crea `activity` memory en cada commit/merge
- `enable_decision_extraction`
  - activa extracción asíncrona de decision por LLM
- `decision_extraction_mode`
  - `llm_only`: procesa por recencia
  - `hybrid_priority`: prioriza eventos con mayor score
- `decision_default_status`
  - estado inicial de decisions creadas por LLM
- `decision_auto_confirm_enabled`
  - activa auto-confirm
- `decision_auto_confirm_min_confidence`
  - umbral de auto-confirm
- `decision_batch_size`
  - máximo de eventos por corrida
- `decision_backfill_days`
  - ventana de retrospectiva

## Políticas de keywords (solo priorización)

Cada política define:

- keywords positivas/negativas
- patrones de archivo positivos/negativos
- pesos positivos/negativos
- enabled

Importante: estas políticas **no** deciden si algo es decision.  
Solo alteran la prioridad de ejecución del LLM.

## Panel de decisions

- filtros: project / status / confidence range
- evidencia: `raw_event_id`, `commit_sha`
- acciones: `Confirm`, `Reject`

## Valores recomendados

- `enable_activity_auto_log = true`
- `enable_decision_extraction = true`
- `decision_extraction_mode = llm_only`
- `decision_default_status = draft`
- `decision_auto_confirm_enabled = false`
- `decision_auto_confirm_min_confidence = 0.90`
- `decision_batch_size = 25`
- `decision_backfill_days = 30`

Última actualización: 2026-02-19
