# SIEM Integration

Claustrum can push append-only audit events to external SIEM endpoints through **Audit Sinks**.

## Audit Sink Model

- `audit_sinks`: destination + filter + retry policy.
- `audit_delivery_queue`: durable delivery queue per `(sink_id, audit_log_id)`.

## Delivery Flow

1. `audit_logs` row is inserted.
2. Matching sinks are selected by `event_filter`.
3. Rows are enqueued into `audit_delivery_queue`.
4. Background worker sends HTTP POST with HMAC signature.
5. Success: `delivered`, failure: backoff retry, then `failed`.

## Signing

Each webhook request includes:

- `X-Claustrum-Event`
- `X-Claustrum-Workspace`
- `X-Claustrum-Delivery`
- `X-Claustrum-Signature: sha256=<hex>`

Signature input:

```text
HMAC_SHA256(secret, raw_json_body)
```

## Retry / Backoff

Per sink `retry_policy`:

```json
{
  "max_attempts": 5,
  "backoff_sec": [1, 5, 30, 120, 600]
}
```

## Admin UI

`Workspace → Integrations → SIEM`

- Create sink
- Test delivery
- Filtered delivery status view (`queued/sending/delivered/failed`)

Last Updated: 2026-02-17
