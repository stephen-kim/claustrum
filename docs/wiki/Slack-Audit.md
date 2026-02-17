# Slack Audit Integration


## Goal

Send audit events to Slack so the team can see:
- who changed settings
- what changed
- why it changed

This is an outbound notification integration (no MCP read tool).


## What You Need

- Slack Incoming Webhook URL
  - Create a Slack app -> Incoming Webhooks -> add webhook to channel
- `workspace_key` in memory-core (example: `personal`)


## Environment Variables (Fallback)

- `MEMORY_CORE_AUDIT_SLACK_WEBHOOK_URL`
- `MEMORY_CORE_AUDIT_SLACK_ACTION_PREFIXES`
- `MEMORY_CORE_AUDIT_SLACK_DEFAULT_CHANNEL`
- `MEMORY_CORE_AUDIT_SLACK_FORMAT`
- `MEMORY_CORE_AUDIT_SLACK_INCLUDE_TARGET_JSON`
- `MEMORY_CORE_AUDIT_SLACK_MASK_SECRETS`


## Step-by-Step Setup

1. Create Slack webhook
- Generate webhook URL from your Slack app.
- Keep it secret.

2. Save config in Admin UI
- Open `admin-ui` -> Integrations -> Slack Audit.
- Save:
  - `enabled=true`
  - `webhook_url`
  - `default_channel` (optional)
  - `action_prefixes` (optional filter list)
  - `format` (`detailed` or `compact`)
  - `include_target_json` / `mask_secrets`
  - optional `routes` and `severity_rules`

3. Save config via API (optional)

```bash
curl -X PUT "$MEMORY_CORE_URL/v1/integrations" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_key": "personal",
    "provider": "slack",
    "enabled": true,
    "reason": "enable slack audit notifications",
    "config": {
      "webhook_url": "https://hooks.slack.com/services/XXX/YYY/ZZZ",
      "default_channel": "#audit-core",
      "action_prefixes": ["integration.", "workspace_settings.", "git.", "ci."],
      "format": "detailed",
      "include_target_json": true,
      "mask_secrets": true,
      "routes": [
        { "action_prefix": "ci.", "channel": "#audit-devflow", "min_severity": "medium" },
        { "action_prefix": "integration.", "channel": "#audit-security", "min_severity": "high" }
      ],
      "severity_rules": [
        { "action_prefix": "integration.", "severity": "high" },
        { "action_prefix": "raw.", "severity": "low" }
      ]
    }
  }'
```

4. Trigger and verify
- Trigger an audited action (example: save any integration setting with `reason`).
- Check Slack channel for message delivery.
- Check API-side logs:

```bash
curl -G "$MEMORY_CORE_URL/v1/audit-logs" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  --data-urlencode "workspace_key=personal" \
  --data-urlencode "action_prefix=integration." \
  --data-urlencode "limit=20"
```


## Config Reference

- `webhook_url`: Incoming webhook endpoint
- `default_channel`: fallback Slack channel
- `action_prefixes`: notify only when action starts with one of prefixes
- `format`: `detailed` or `compact`
- `include_target_json`: include serialized audit target
- `mask_secrets`: redact tokens/secrets from payload text
- `routes`: `[{ action_prefix, channel?, min_severity? }]`
- `severity_rules`: `[{ action_prefix, severity }]`

Severity values:
- `low`
- `medium`
- `high`
- `critical`


## Env vs Admin UI Priority

- Default: workspace config in Admin UI wins over env fallback.
- Exception: `audit_reasoner` uses `ENV > Admin UI` precedence.
  - Env keys: `MEMORY_CORE_AUDIT_REASONER_*`, `OPENAI_API_KEY`, `GEMINI_API_KEY`
  - Admin UI fallback: Integrations -> Audit Reasoner
- Lock option:
  - `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=slack`
  - When locked, Admin UI updates are blocked and env-only is enforced.


## Troubleshooting

- No Slack message
  - Verify webhook URL is valid and `enabled=true`.
  - If `action_prefixes` is set, confirm action matches prefix.
  - If `routes.min_severity` is set, confirm severity threshold matches.
- `Integration provider "slack" is locked...`
  - Remove `slack` from `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS` or manage via env only.
