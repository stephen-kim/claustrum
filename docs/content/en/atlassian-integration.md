# Atlassian Integration (Jira + Confluence)


## Goal

Use Jira and Confluence as external context sources in MCP workflows:
- Jira: search/read issue context
- Confluence: search/read documentation context
- Both are read-focused and audited


## What You Need

- Atlassian Cloud site URL (example: `https://your-org.atlassian.net`)
- Atlassian account email
- Atlassian API token
  - Generate from Atlassian account security settings
- `workspace_key` in memory-core (example: `personal`)


## Environment Variables (Fallback)

- Jira
  - `MEMORY_CORE_JIRA_BASE_URL`
  - `MEMORY_CORE_JIRA_EMAIL`
  - `MEMORY_CORE_JIRA_API_TOKEN`
- Confluence
  - `MEMORY_CORE_CONFLUENCE_BASE_URL`
  - `MEMORY_CORE_CONFLUENCE_EMAIL`
  - `MEMORY_CORE_CONFLUENCE_API_TOKEN`


## Step-by-Step Setup

1. Generate Atlassian API token
- Create one token and reuse it for Jira + Confluence.
- Keep it in your secret manager.

2. Save config in Admin UI
- Open `admin-ui` -> Integrations.
- Save Jira:
  - `enabled=true`
  - `base_url`
  - `email`
  - `api_token`
- Save Confluence:
  - `enabled=true`
  - `base_url` (`https://your-org.atlassian.net` or `https://your-org.atlassian.net/wiki`)
  - `email`
  - `api_token`
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
    "provider": "jira",
    "enabled": true,
    "reason": "enable jira context for team",
    "config": {
      "base_url": "https://your-org.atlassian.net",
      "email": "you@company.com",
      "api_token": "atlassian-token"
    }
  }'
```

```bash
curl -X PUT "$MEMORY_CORE_URL/v1/integrations" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_key": "personal",
    "provider": "confluence",
    "enabled": true,
    "reason": "enable confluence context for docs",
    "config": {
      "base_url": "https://your-org.atlassian.net/wiki",
      "email": "you@company.com",
      "api_token": "atlassian-token"
    }
  }'
```

4. Validate with API

```bash
curl -G "$MEMORY_CORE_URL/v1/jira/search" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  --data-urlencode "workspace_key=personal" \
  --data-urlencode "q=deployment incident" \
  --data-urlencode "limit=5"
```

```bash
curl -G "$MEMORY_CORE_URL/v1/confluence/search" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  --data-urlencode "workspace_key=personal" \
  --data-urlencode "q=runbook" \
  --data-urlencode "limit=5"
```

5. Validate from MCP tools
- `jira_search({ q, limit? })`
- `jira_read({ issue_key, max_chars? })`
- `confluence_search({ q, limit? })`
- `confluence_read({ page_id, max_chars? })`


## API Endpoints

Jira:
- `GET /v1/jira/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/jira/read?workspace_key=<ws>&issue_key=<ABC-123>&max_chars=4000`

Confluence:
- `GET /v1/confluence/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/confluence/read?workspace_key=<ws>&page_id=<id-or-url>&max_chars=4000`


## Permissions and Audit

- Read/search requires workspace member access
- All calls are logged to `audit_logs`:
  - `jira.search`
  - `jira.read`
  - `confluence.search`
  - `confluence.read`


## Env vs Admin UI Priority

- Default: workspace config in Admin UI wins over env fallback.
- Lock option:
  - `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=jira,confluence`
  - When locked, Admin UI updates are blocked and env-only is enforced.


## Troubleshooting

- `Invalid API key`
  - Check `Authorization: Bearer <key>`.
- `Integration not configured` style errors
  - Verify `base_url`, `email`, `api_token` were saved for the workspace.
- Search works but read fails
  - Confirm issue key/page id exists and permission is granted in Atlassian.
