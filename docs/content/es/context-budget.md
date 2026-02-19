# Presupuesto de contexto

Claustrum arma contexto por presupuesto de tokens, no por recorte fijo de cantidad.

## Settings de workspace

- `bundle_token_budget_total` (default: `3000`)
- `bundle_budget_global_workspace_pct` (default: `0.15`)
- `bundle_budget_global_user_pct` (default: `0.10`)
- `bundle_budget_project_pct` (default: `0.45`)
- `bundle_budget_retrieval_pct` (default: `0.30`)

## Asignación

Con presupuesto total `B`:

- workspace global: `B * workspace_pct`
- user global: `B * user_pct`
- retrieval: `B * retrieval_pct`
- project snapshot: se reparte en secciones acotadas

## Orden de selección de Global Rules

1. `pinned=true`
2. `severity=high`
3. resto por modo (`score` / `recent` / `priority_only`)

Si hay muchas reglas, se usa summary para comprimir.

## Qué ver en debug

`GET /v1/context/bundle?...&mode=debug`

- presupuesto por sección
- conteos seleccionados/omitidos
- modo de selección
- score breakdown de retrieval

## Recomendaciones

- mantener `global_workspace_pct + global_user_pct` cerca de `0.20 ~ 0.35`
- mantener retrieval en `>= 0.25` para consultas
- crecer con summary, no con hard limits

Última actualización: 2026-02-19
