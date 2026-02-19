# Home

Claustrum is a shared memory layer for AI systems.
It helps teams keep project context consistent across repositories, tools, and developers.

## What You Can Do

- Store and retrieve structured memories (`decision`, `constraint`, `active_work`, `activity`).
- Run MCP safely with protocol-clean stdio (`stdout` for JSON-RPC only).
- Sync project access from GitHub and identity from OIDC.
- Operate with strong auditability (access timeline, append-only audit logs, export/retention).
- Tune context quality with bundle routing, ranking, personas, and debug visibility.

## Start Here

- [Installation](installation)
- [Environment Variables](environment-variables)
- [Authentication Strategy](authentication-strategy)
- [Operations Guide](operations)
- [API Reference](api-reference)

## One-line MCP Config Helper

macOS / Linux:

```shell
curl -fsSL https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -o ./claustrum-mcp-config-helper.js && node ./claustrum-mcp-config-helper.js
```

Windows PowerShell:

```powershell
iwr https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -OutFile .\claustrum-mcp-config-helper.js; node .\claustrum-mcp-config-helper.js
```

## System Components

- `memory-core`: REST API + Postgres + policy engine.
- `mcp-adapter`: MCP stdio bridge that calls memory-core.
- `admin-ui`: web console for setup, access control, integrations, and observability.

## Documentation Notes

- This docs set is written for admins and end users.
- The focus is operational behavior and user outcomes.
