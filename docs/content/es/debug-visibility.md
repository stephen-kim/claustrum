# Visibilidad de depuración de contexto

Claustrum incluye una vista de depuración de contexto orientada a operación.

## Ubicación

Project -> Context Debug

## Funciones principales

- vista previa de bundle (`default` / `debug`)
- workspace/project resuelto y modo monorepo
- señal de subpath actual
- score breakdown por resultado (en debug)
- resultados recientes de decision extraction (resultado, confidence, error)

## Para qué sirve

- explicar por qué un resultado fue seleccionado
- validar configuración monorepo/subpath
- detectar deriva de ranking o problemas del extractor

## Nota

- Es una vista de observabilidad/tuning.
- El raw completo sigue protegido; solo se muestran snippets y referencias.

Última actualización: 2026-02-19
