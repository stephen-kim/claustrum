# Seguimiento del uso de LLM

Claustrum registra uso por llamada LLM para visibilidad de tokens y coste estimado.

## Qué se registra

- `workspace_id`
- `project_id` (si existe)
- `actor_user_id` o `system_actor`
- `purpose` (`decision_extract`, `summarize`, `routing`, `eval_judge`, ...)
- `provider`, `model`
- `input_tokens`, `output_tokens` (si el proveedor los devuelve)
- `estimated_cost_cents` (basado en `llm_pricing`)
- `correlation_id`
- `created_at`

## Qué NO se registra

- prompt completo
- respuesta completa
- cabeceras Authorization o API keys

## Cálculo de coste

`llm_pricing` define precios por modelo.

```text
estimated_cost_cents =
  (input_tokens / 1000) * input_token_price_per_1k_cents +
  (output_tokens / 1000) * output_token_price_per_1k_cents
```

## API de uso

`GET /v1/usage/llm`

Parámetros:

- `workspace_key` (obligatorio)
- `from` (opcional)
- `to` (opcional)
- `group_by` = `day | purpose | model` (default: `day`)

## Panel de administración

En **LLM Usage** puedes ver:

- agrupación por día/propósito/modelo
- filtro por rango de fechas
- total de tokens de entrada/salida
- coste estimado total
- desglose por grupo
