# Linear Integration


## Goal

Use Linear as an external issue context source for MCP workflows:
- search relevant issues
- read issue details for short context
- keep memory recall memory-first


## What You Need

- Linear API key
  - Create from Linear settings (Personal API key)
- Optional custom API URL (default: `https://api.linear.app/graphql`)
- `workspace_key` in memory-core (example: `personal`)


## Environment Variables (Fallback)

- `MEMORY_CORE_LINEAR_API_KEY`
- `MEMORY_CORE_LINEAR_API_URL`


## Step-by-Step Setup

1. Generate Linear API key
- Use a dedicated service account or admin account for team stability.
- Store it in your secret manager.

2. Save config in Admin UI
- Open `admin-ui` -> Integrations -> Linear.
- Save:
  - `enabled=true`
  - `api_key`
  - `api_url` (optional)
- Optional:
  - `write_on_commit`
  - `write_on_merge`
  - These currently drive audit/hook routing, not provider-side write.

3. Save config via API (optional)

```bash
curl -X PUT "$MEMORY_CORE_URL/v1/integrations" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_key": "personal",
    "provider": "linear",
    "enabled": true,
    "reason": "enable linear issue context",
    "config": {
      "api_key": "lin_api_xxx",
      "api_url": "https://api.linear.app/graphql"
    }
  }'
```

4. Validate with API

```bash
curl -G "$MEMORY_CORE_URL/v1/linear/search" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  --data-urlencode "workspace_key=personal" \
  --data-urlencode "q=incident runbook" \
  --data-urlencode "limit=5"
```

```bash
curl -G "$MEMORY_CORE_URL/v1/linear/read" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  --data-urlencode "workspace_key=personal" \
  --data-urlencode "issue_key=ENG-123" \
  --data-urlencode "max_chars=2000"
```

5. Validate from MCP tools
- `linear_search({ q, limit? })`
- `linear_read({ issue_key, max_chars? })`


## API Endpoints

- `GET /v1/linear/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/linear/read?workspace_key=<ws>&issue_key=<ENG-123>&max_chars=4000`


## Permissions and Audit

- Linear read/search requires workspace member access
- All calls are logged to `audit_logs`:
  - `linear.search`
  - `linear.read`


## Env vs Admin UI Priority

- Default: workspace config in Admin UI wins over env fallback.
- Lock option:
  - `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=linear`
  - When locked, Admin UI updates are blocked and env-only is enforced.


## Troubleshooting

- `Integration not configured` style errors
  - Verify workspace has `api_key` saved and `enabled=true`.
- Search works but read fails
  - Confirm issue key exists and API key has access to the team/project.
