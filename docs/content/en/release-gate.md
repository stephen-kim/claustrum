# Release Gate

Release Gate runs high-risk pre-release QC checks in one command.

## Run

```shell
RELEASE_GATE_RESET_DB=true ./scripts/release-gate.sh
```

## Environment Variables

- `BASE_URL` (default: `http://localhost:8080`)
- `RELEASE_GATE_RESET_DB` (`true`/`false`, default: `false`)
- `RELEASE_GATE_TIMEOUT_SEC` (default: `180`)
- `RELEASE_GATE_COMPOSE_FILE` (default: `docker-compose.dev.yml`)
- `RELEASE_GATE_COMPOSE_PROFILE` (default: `localdb`)

## Gate Sequence

1. `pnpm lint`
2. `pnpm test`
3. `docker compose --profile localdb up -d` (optional reset with `down -v`)
4. `scripts/qc/bootstrap.sh`
5. `scripts/qc/isolation.sh`
6. `scripts/qc/rbac.sh`
7. `scripts/qc/webhooks.sh`
8. `scripts/qc/secrets.sh`

Any failing check exits with status `1` and prints a clear error.

Release Gate sets `MEMORY_CORE_RUN_SEED=false` by default so bootstrap admin flow can be validated consistently.

## What Each QC Script Verifies

- `bootstrap.sh`
  - bootstrap admin one-time password log behavior
  - `must_change_password` gating before setup
  - setup completion opens protected APIs
- `isolation.sh`
  - workspace A/B data isolation for memories/raw search
- `rbac.sh`
  - reader cannot write
  - writer can write but cannot confirm decision
  - maintainer can confirm decision
  - audit export remains admin-only
- `webhooks.sh`
  - invalid signature returns `401`
  - duplicate delivery ID is handled safely
- `secrets.sh`
  - log scan for key/private-key/password leakage patterns
  - DB schema check for hashed API key storage
  - one-time API key view cannot be reused

## CI Example

```yaml
- name: Release Gate
  run: RELEASE_GATE_RESET_DB=true ./scripts/release-gate.sh
```
