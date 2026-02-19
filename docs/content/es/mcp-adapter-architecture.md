# Arquitectura del adaptador MCP

En Claustrum, el adaptador MCP se ejecuta localmente como proceso ligero.  
La lógica de contexto y el almacenamiento viven en el servidor remoto de Claustrum.

## Estructura en runtime

```text
~/.claustrum/
  bin/claustrum-mcp
  adapter/
    current/
    versions/vX.Y.Z/
  logs/
    adapter.log
    error.log
  state.json
  update.lock
```

## Flujo de solicitud

1. El cliente MCP envía JSON-RPC por stdio.
2. El adaptador local lee frames MCP desde stdin.
3. Reenvía cada payload a `POST ${CLAUSTRUM_BASE_URL}/v1/mcp`.
4. Escribe la respuesta remota a stdout en formato JSON-RPC.
5. Los logs se envían solo a stderr o archivos.

## Seguridad de stdout y logs

- `stdout`: solo JSON-RPC
- `stderr`: logs operativos y errores

Rotación:

- `adapter.log` hasta 5MB
- `error.log` hasta 5MB
- `~/.claustrum/logs` total máximo 10MB

API keys, tokens bearer y bloques de clave privada se enmascaran antes de registrarse.

## Flujo de auto-update

- Consulta GitHub Releases con ETag.
- Usa `update.lock` para evitar carreras de actualización.
- Verifica descarga con `SHA256SUMS`.
- Cambia el symlink `adapter/current` de forma atómica.
- Si falla, mantiene la versión anterior.

## Supuestos de seguridad

- En producción, usa HTTPS en `CLAUSTRUM_BASE_URL`.
- No desactivar validación de certificados TLS.
- Fuente de actualización fija al repositorio permitido.

## Solución de problemas

- no conecta al upstream: revisar `CLAUSTRUM_BASE_URL`, red y cadena TLS
- no actualiza: revisar `~/.claustrum/state.json`, `update.lock`, `~/.claustrum/logs/error.log`
- error de protocolo MCP: confirmar que stdout no incluye texto fuera de JSON-RPC
