# Operations

## Data and Recall Model

- Default recall reads from `memories` only.
- Raw imported transcripts are separated from default recall flow.
- Optional raw tools return snippets only.

## Raw Import Pipeline

1. `POST /v1/imports` (multipart upload)
2. `POST /v1/imports/:id/parse`
3. `POST /v1/imports/:id/extract`
4. `POST /v1/imports/:id/commit`

Data path:
- `imports` -> `raw_sessions/raw_messages` -> `staged_memories` -> `memories`

Supported parser behavior:
- `source=codex`: Codex JSONL parser
- `source=claude`: Claude JSON export parser (role normalization: `human -> user`, `assistant -> assistant`)
- fallback: generic text chunk parser

## Project Resolution

Default order:
1. `github_remote`
2. `repo_root_slug`
3. `manual`

Configured at workspace level:
- `resolution_order`
- `auto_create_project`
- key prefixes
- `project_mappings`

## Admin UI Checklist

- Manage workspace/project/member
- Manage resolution settings and mappings
- Run imports and commit staged memories
- Execute raw snippet search
- Review audit logs (`raw.search`, `raw.view`)

## Useful Commands

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm test:workspace
```

## Backup/Recovery Baseline

- Back up Postgres regularly.
- Keep migration SQL in version control.
- Verify restore by replaying:
  - migrate
  - seed (idempotent)
  - smoke tests
