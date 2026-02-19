# Context Bundle API

Claustrum provides a normalized context bundle so Codex/Claude/Cursor-like clients can consume the same project context shape.

## Endpoint

- `GET /v1/context/bundle`

### Query

- `workspace_key` (required)
- `project_key` (required)
- `q` (optional)
- `current_subpath` (optional)
- `mode` = `default` | `debug` (optional, default `default`)
- `budget` (optional)

## Response Shape

```json
{
  "project": { "key": "github:owner/repo#apps/memory-core", "name": "memory-core" },
  "snapshot": {
    "summary": "...",
    "top_decisions": [],
    "top_constraints": [],
    "active_work": [],
    "recent_activity": []
  },
  "retrieval": {
    "query": "resolver fallback",
    "results": []
  },
  "debug": {
    "resolved_workspace": "personal",
    "resolved_project": "github:owner/repo",
    "monorepo_mode": "shared_repo",
    "current_subpath": "apps/memory-core",
    "boosts_applied": {},
    "token_budget": {}
  }
}
```

## Rules

- Bundle returns concise, curated text for prompt injection into MCP clients.
- Raw message bodies are never embedded directly in bundle payload.
- Raw references appear as `evidence_ref` only.
- `mode=debug` adds extra scoring and resolution details for troubleshooting.

## MCP Usage

`mcp-adapter` exposes `context_bundle()` and can call this endpoint before `recall`/`remember` pipelines.
