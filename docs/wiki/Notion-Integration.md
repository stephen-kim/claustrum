# Notion Integration

## Goal

Use Notion as external context for AI workflows:
- read/search docs during coding sessions
- optional write-back on merge (recommended over local git hooks)

## Server Configuration

`memory-core` env:

- `MEMORY_CORE_NOTION_TOKEN` (required for read/search)
- `MEMORY_CORE_NOTION_DEFAULT_PARENT_PAGE_ID` (optional default parent for create)
- `MEMORY_CORE_NOTION_WRITE_ENABLED=true` (required for write API)

You can also configure Notion per workspace in Admin UI (`/v1/integrations`) without server env variables.

Workspace config keys:
- `token`
- `default_parent_page_id`
- `write_enabled` (boolean)

## API Endpoints

Read/search:
- `GET /v1/notion/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/notion/read?workspace_key=<ws>&page_id=<id-or-url>&max_chars=4000`

Write (admin only):
- `POST /v1/notion/write`

Example:

```json
{
  "workspace_key": "personal",
  "title": "Merge Summary",
  "content": "What changed and why...",
  "page_id": "optional-existing-page-id",
  "parent_page_id": "optional-parent-page-id"
}
```

## MCP Tools

`mcp-adapter` adds:
- `notion_search({ q, limit? })`
- `notion_read({ page_id, max_chars? })`
- `notion_context({ q?, page_id?, limit?, max_chars? })`

Recommended usage:
1. `notion_context({ q: "<project/topic>" })` for quick context bootstrap
2. `notion_read({ page_id })` for focused deep read if needed

These tools call memory-core endpoints and follow MCP stdio policy.

## Permissions and Audit

- Notion read/search: workspace member access
- Notion write: workspace admin + `MEMORY_CORE_NOTION_WRITE_ENABLED=true`
- Audit actions:
  - `notion.search`
  - `notion.read`
  - `notion.write`

## Merge-Based Write (Recommended)

Prefer merge-triggered docs sync in CI (e.g., GitHub Actions) over local git hooks.

Why:
- consistent runtime + secrets
- avoids local env drift
- no developer-side hook failures

Suggested flow:
1. Trigger on `push` to `main`
2. Build commit/PR summary
3. Call `/v1/notion/write` with admin API key
4. Record result in workflow logs

Reference workflow:
- `/Users/stephen/dev/context-sync/.github/workflows/notion-merge-sync.yml`
