# Reglas de detección

Detection Rules permite detectar patrones sospechosos con reglas de umbral.

## Modelo de datos

- `detection_rules`: reglas
- `detections`: incidentes detectados (`open|ack|closed`)

## Ejemplo de regla

```json
{
  "name": "Raw search burst",
  "enabled": true,
  "severity": "high",
  "condition": {
    "type": "threshold",
    "action_key": "raw.search",
    "window_sec": 300,
    "count_gte": 20,
    "group_by": "actor_user_id"
  },
  "notify": {
    "via": "security_stream"
  }
}
```

## Cómo funciona

- Worker cada minuto
- Evalúa reglas activas contra `audit_logs`
- Crea una detección por `(rule, group, time-bucket)` para evitar duplicados
- Emite `security.detection.triggered`

## Reglas seed por defecto

- Raw search burst: 5 min con `raw.search >= 20`
- Permission churn: 10 min con `access.project_member.role_changed >= 30`
- API key churn: 10 min con `api_key.reset >= 5`

## Operación recomendada

- empezar con reglas de severidad alta
- observar una semana
- ajustar umbrales para bajar falsos positivos
