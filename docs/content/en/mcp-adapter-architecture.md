# MCP Adapter Architecture

Claustrum runs the MCP adapter locally as a thin process, while context logic and data stay on remote Claustrum services.

## Runtime layout

```text
~/.claustrum/
  bin/claustrum-mcp
  adapter/
    current/
    versions/vX.Y.Z/
  logs/
    adapter.log
    error.log
  state.json
  update.lock
```text

## Request path

1. MCP client sends JSON-RPC over stdio.
2. Local adapter parses MCP frames from stdin.
3. Adapter forwards each payload to `POST ${CLAUSTRUM_BASE_URL}/v1/mcp`.
4. Remote JSON-RPC response is written back to stdout as MCP frame.
5. Logs are written to stderr/files only.

## Logging and stdout safety

- `stdout`: JSON-RPC only.
- `stderr`: operational logs.
- Log rotation policy:
  - `adapter.log` up to 5MB
  - `error.log` up to 5MB
  - total `~/.claustrum/logs` capped at 10MB

Sensitive values such as API keys, bearer tokens, and private key blocks are masked before logging.

## Auto-update flow

- Checks GitHub Releases using ETag.
- Uses `update.lock` to avoid concurrent update races.
- Verifies downloaded runtime with `SHA256SUMS`.
- Swaps `adapter/current` symlink atomically.
- Keeps previous version on failure.

## Security defaults

- Production should use HTTPS for `CLAUSTRUM_BASE_URL`.
- Adapter does not disable TLS certificate verification.
- Update source is pinned to approved repository.

## Troubleshooting

- Upstream unreachable: verify `CLAUSTRUM_BASE_URL`, network, TLS trust chain.
- Update skipped: check `~/.claustrum/state.json`, `update.lock`, `~/.claustrum/logs/error.log`.
- MCP protocol errors: confirm no non-protocol output is written to stdout.
