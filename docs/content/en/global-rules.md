# Global Rules

Last Updated: 2026-02-18

Claustrum supports two global rule scopes:

- `workspace` global rules: shared by everyone in the workspace.
- `user` global rules: personal rules for a specific user inside the workspace.

## Design Goals

- No hard cap like "max 5 rules".
- Use token budget + score-based selection instead of hard truncation.
- Keep important rules (`pinned` / `high`) highly prioritized.
- Preserve quality with soft guidance and summary fallback.

## Rule Fields

Each rule stores:

- `title`, `content`
- `category`: `policy | security | style | process | other`
- `priority`: `1..5`
- `severity`: `low | medium | high`
- `pinned`, `enabled`

## API

- `GET /v1/global-rules?workspace_key=...&scope=workspace|user&user_id?`
- `POST /v1/global-rules`
- `PUT /v1/global-rules/:id`
- `DELETE /v1/global-rules/:id`
- `POST /v1/global-rules/summarize`

### Summarize endpoint

`POST /v1/global-rules/summarize`

Body:

```json
{
  "workspace_key": "personal",
  "scope": "workspace",
  "mode": "preview"
}
```

Modes:

- `preview`: returns summary text only.
- `replace`: upserts `global_rule_summaries` for bundle compression.

## Soft Guardrails

Workspace settings control guidance thresholds:

- `global_rules_recommend_max` (default `5`)
- `global_rules_warn_threshold` (default `10`)

Behavior:

- Above recommend max: info-level guidance.
- At/above warn threshold: warning-level quality warning.

## Admin UI

`Workspace → Global Rules`

- CRUD for workspace/user scope rules.
- Set severity, priority, pinned, enabled.
- See recommendation/warning badges.
- Auto summarize (`preview` / `apply`).
- Configure selection mode and budget percentages.

## Security & Permissions

- Workspace scope rules: workspace admin required.
- User scope rules: self or workspace admin.
- Summary apply writes `global_rules.summarized` audit event.
