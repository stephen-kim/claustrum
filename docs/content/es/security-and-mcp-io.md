# Seguridad y E/S de MCP

## Política de MCP sobre stdio

Para servidores/adapters MCP:

- `stdout`: solo mensajes JSON-RPC
- `stderr`: solo logs y errores

No mezclar banners, mensajes de arranque ni trazas de migración en stdout.

## Protecciones para datos raw

- `raw.search` devuelve solo snippets
- vista de mensaje raw individual también solo snippet
- se aplica límite `max_chars`
- por defecto, no devolver transcripciones completas de sesión

## Control de acceso

- Requiere API key (`Authorization: Bearer <key>`)
- `raw.search` / `raw.view` con control estricto:
  - admin o miembro del proyecto
  - búsqueda raw a nivel workspace requiere admin/owner de workspace

## Requisitos de auditoría

Registrar y revisar al menos:

- `raw.search`
- `raw.view`

El audit log debe incluir actor, target y timestamp.

## Notas de despliegue

- Usar TLS en conexiónes externas a DB (`sslmode=require`)
- Rotar API keys periódicamente
- No registrar secretos en stderr
