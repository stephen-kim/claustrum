# Linear Integration

## Goal

Use Linear as an external issue context source for MCP workflows:
- search relevant issues
- read issue details for short context
- keep memory recall memory-first

## Server Configuration

`memory-core` environment:

- `MEMORY_CORE_LINEAR_API_KEY` (required)
- `MEMORY_CORE_LINEAR_API_URL` (optional, default: `https://api.linear.app/graphql`)

If `MEMORY_CORE_LINEAR_API_KEY` is missing, Linear endpoints return a clear validation error.

You can also configure Linear per workspace in Admin UI (`/v1/integrations`) without server env variables.

## API Endpoints

- `GET /v1/linear/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/linear/read?workspace_key=<ws>&issue_key=<ENG-123>&max_chars=4000`

## MCP Tools

`mcp-adapter` adds:
- `linear_search({ q, limit? })`
- `linear_read({ issue_key, max_chars? })`

## Permissions and Audit

- Linear read/search requires workspace member access
- All calls are logged to `audit_logs`:
  - `linear.search`
  - `linear.read`
