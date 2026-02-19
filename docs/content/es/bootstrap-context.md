# Contexto inicial (Bootstrap)

Bootstrap Context crea memoria mínima útil justo después de crear un proyecto.

## Cuándo se ejecuta

- Automático: al crear proyecto (best-effort)
- Manual por API: `POST /v1/projects/:key/bootstrap`
- Admin UI: botón `Bootstrap context` en Project Settings

## Fuentes que usa

Cuando existen, toma señal de:

- `README.md`
- `package.json`
- `docker-compose.yml` / `docker-compose.yaml`
- `infra/docker-compose.yml` / `infra/docker-compose.yaml`
- Git raw events recientes (`post_commit`, `post_merge`, `post_checkout`)

## Memory generado

- `type`: `summary`
- `status`: `confirmed`
- `source`: `auto`
- `metadata.source`: `bootstrap`
- `metadata.files`: lista de archivos usados

## Si falla

- No bloquea el proyecto.
- Si faltan archivos, el sistema sigue funcionando.
- Se puede reintentar manualmente.

Última actualización: 2026-02-19
