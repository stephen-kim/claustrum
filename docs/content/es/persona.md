# Persona

Persona define qué tipo de contexto prioriza Claustrum para cada usuario.
No cambia permisos ni roles.

## Modos

- `neutral` (default): balanceado, con leve boost a active work
- `author`: foco en implementación (active work / recent activity)
- `reviewer`: foco en riesgo y calidad (constraints / decisions)
- `architect`: foco en diseño de sistema (decisions / constraints)

## Recomendación (solo sugerencia)

- `GET /v1/context/persona-recommendation?workspace_key=...&project_key=...&q=...`
- Es una recomendación, no auto-cambio.
- La fuente de verdad sigue siendo la selección del usuario.

## Flujo de aplicación

1. Abre Context Debug
2. Ejecuta recomendación con tu consulta
3. Si te sirve, aplica `Apply Recommended Persona`

El cambio queda auditado como `user.persona.changed`.

Última actualización: 2026-02-19
