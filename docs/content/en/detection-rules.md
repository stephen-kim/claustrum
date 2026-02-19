# Detection Rules

Claustrum includes a minimal threshold-based detection engine for suspicious access patterns.

## Data Model

- `detection_rules`: rule definitions
- `detections`: triggered findings (`open|ack|closed`)

## Rule Schema (Threshold)

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

## Engine Behavior

- Worker runs every minute.
- Evaluates enabled rules against recent `audit_logs`.
- Creates one detection per `(rule, group, time-bucket)` to avoid duplicates.
- Emits `security.detection.triggered` audit event with correlation ID.
- Security stream then forwards to SIEM sink(s).

## Seeded Default Rules

- Raw search burst: `raw.search >= 20` in 5 minutes per actor.
- Permission churn: `access.project_member.role_changed >= 30` in 10 minutes.
- API key churn: `api_key.reset >= 5` in 10 minutes.

## Operations

Admin UI:

- Create / update / delete rules
- View detections
- Ack / close detections

Recommended rollout plan:

1. Start with high-severity rules only.
2. Observe for one week.
3. Tune thresholds to reduce false positives.
