# Notion Integration


## Goal

Use Notion as external context for AI workflows:
- read/search docs during coding sessions
- optional write-back on merge (recommended over local git hooks)


## What You Need

- Notion integration token
  - Create an internal integration in Notion developers
- Target pages/databases shared with that integration
- `workspace_key` in memory-core (example: `personal`)


## Environment Variables (Fallback)

- `MEMORY_CORE_NOTION_TOKEN`
- `MEMORY_CORE_NOTION_DEFAULT_PARENT_PAGE_ID`
- `MEMORY_CORE_NOTION_WRITE_ENABLED`


## Step-by-Step Setup

1. Create and authorize Notion integration
- Create internal integration and copy token (`secret_...`).
- Share required pages/databases with that integration.

2. Save config in Admin UI
- Open `admin-ui` -> Integrations -> Notion.
- Save:
  - `enabled=true`
  - `token`
  - `default_parent_page_id` (optional)
  - `write_enabled` (enable write API)
  - optional hook flags: `write_on_commit`, `write_on_merge`

3. Save config via API (optional)

```bash
curl -X PUT "$MEMORY_CORE_URL/v1/integrations" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_key": "personal",
    "provider": "notion",
    "enabled": true,
    "reason": "enable notion context and merge write-back",
    "config": {
      "token": "secret_xxx",
      "default_parent_page_id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "write_enabled": true,
      "write_on_merge": true
    }
  }'
```

4. Validate with API

```bash
curl -G "$MEMORY_CORE_URL/v1/notion/search" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  --data-urlencode "workspace_key=personal" \
  --data-urlencode "q=architecture" \
  --data-urlencode "limit=5"
```

```bash
curl -G "$MEMORY_CORE_URL/v1/notion/read" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  --data-urlencode "workspace_key=personal" \
  --data-urlencode "page_id=<notion-page-id-or-url>" \
  --data-urlencode "max_chars=2000"
```

5. Validate from MCP tools
- `notion_search({ q, limit? })`
- `notion_read({ page_id, max_chars? })`
- `notion_context({ q?, page_id?, limit?, max_chars? })`


## Config Keys

- `token`
- `default_parent_page_id`
- `write_enabled`
- `write_on_commit`
- `write_on_merge`


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
- `.github/workflows/notion-merge-sync.yml`


## Env vs Admin UI Priority

- Default: workspace config in Admin UI wins over env fallback.
- Lock option:
  - `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=notion`
  - When locked, Admin UI updates are blocked and env-only is enforced.


## Troubleshooting

- Search/read returns configuration error
  - Check token, page sharing, and `enabled=true`.
- Write fails
  - Check workspace admin permission and `write_enabled=true`.
- Merge hook write does not fire
  - Check `write_on_merge=true` and hook/event forwarding settings.
