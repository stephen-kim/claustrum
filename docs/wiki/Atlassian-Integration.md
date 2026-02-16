# Atlassian Integration (Jira + Confluence)

## Goal

Use Jira and Confluence as external context sources in MCP workflows:
- Jira: search/read issue context
- Confluence: search/read documentation context
- Both are read-focused and audited

## Server Configuration

`memory-core` environment:

- `MEMORY_CORE_JIRA_BASE_URL` (example: `https://your-org.atlassian.net`)
- `MEMORY_CORE_JIRA_EMAIL`
- `MEMORY_CORE_JIRA_API_TOKEN`
- `MEMORY_CORE_CONFLUENCE_BASE_URL` (example: `https://your-org.atlassian.net` or `.../wiki`)
- `MEMORY_CORE_CONFLUENCE_EMAIL`
- `MEMORY_CORE_CONFLUENCE_API_TOKEN`

If variables are missing, endpoints return a clear validation error and remain disabled.

You can also configure Jira/Confluence per workspace in Admin UI (`/v1/integrations`) without server env variables.

## API Endpoints

Jira:
- `GET /v1/jira/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/jira/read?workspace_key=<ws>&issue_key=<ABC-123>&max_chars=4000`

Confluence:
- `GET /v1/confluence/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/confluence/read?workspace_key=<ws>&page_id=<id-or-url>&max_chars=4000`

## MCP Tools

`mcp-adapter` adds:
- `jira_search({ q, limit? })`
- `jira_read({ issue_key, max_chars? })`
- `confluence_search({ q, limit? })`
- `confluence_read({ page_id, max_chars? })`

## Permissions and Audit

- Read/search requires workspace member access
- All calls are logged to `audit_logs`:
  - `jira.search`
  - `jira.read`
  - `confluence.search`
  - `confluence.read`

## Notes

- Keep MCP recall memory-first (`remember/recall`).
- Use Jira/Confluence tools only for external context lookup.
