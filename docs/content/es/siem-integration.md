# Integración SIEM

Claustrum puede enviar eventos de auditoría a SIEM externos mediante Audit Sinks.

## Modelo

- `audit_sinks`: destino, filtros y política de reintento
- `audit_delivery_queue`: cola durable por `(sink_id, audit_log_id)`

## Flujo de entrega

1. se inserta un evento en `audit_logs`
2. se seleccionan sinks según `event_filter`
3. se encola en `audit_delivery_queue`
4. el worker envía HTTP POST
5. éxito: `delivered` / fallo: reintentos con backoff -> `failed`

## Firma

Cabeceras enviadas:

- `X-Claustrum-Event`
- `X-Claustrum-Workspace`
- `X-Claustrum-Delivery`
- `X-Claustrum-Signature: sha256=<hex>`

Cálculo:

```text
HMAC_SHA256(secret, raw_json_body)
```

## Política de reintento

```json
{
  "max_attempts": 5,
  "backoff_sec": [1, 5, 30, 120, 600]
}
```

## Panel de administración

Ruta: `Workspace -> Integrations -> SIEM`

- crear sink
- test delivery
- revisar estado (`queued/sending/delivered/failed`)
