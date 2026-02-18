# CI


## Overview

Claustrum CI runs a **release-gate** job on every pull request and on every push to `main`.

The job uses:
- `pnpm` workspace install/cache
- `docker compose` (localdb profile)
- `scripts/release-gate.sh` with `RELEASE_GATE_RESET_DB=true`


## Workflow

File:
- `.github/workflows/ci.yml`

Triggers:
- `pull_request`
- `push` on `main`

Job:
- `release-gate` (`ubuntu-latest`, `timeout-minutes: 20`)

Main execution flow:
1. Checkout
2. Setup pnpm + Node 20
3. `pnpm install --frozen-lockfile`
4. Prepare `.env` for CI defaults
5. `pnpm lint`
6. `pnpm test`
7. `./scripts/release-gate.sh` (`RELEASE_GATE_RESET_DB=true`)
8. Always run compose cleanup: `docker compose ... down -v --remove-orphans`


## Local Reproduction

Run the same gate locally:

```bash
RELEASE_GATE_RESET_DB=true ./scripts/release-gate.sh
```


## Environment Handling

CI writes a local `.env` file from `.env.example`, then appends non-secret CI defaults:
- `DATABASE_URL`
- `MEMORY_CORE_API_KEY`
- `MEMORY_CORE_SEED_ADMIN_KEY`
- `NEXT_PUBLIC_MEMORY_CORE_URL`
- `GITHUB_APP_WEBHOOK_SECRET`

No production secrets are committed or printed.

`scripts/release-gate.sh` also masks sensitive values in QC logs.


## Failure Artifacts

On failure, CI uploads:
- `release-gate-logs` artifact
- source: last 200 lines of `memory-core` compose logs
- masked for bootstrap password / API key-like tokens


## Troubleshooting

- If CI fails before QC starts:
  - check `pnpm install --frozen-lockfile` and lockfile drift
- If unit tests fail with `ERR_MODULE_NOT_FOUND` for `@claustrum/shared/dist/index.js`:
  - ensure shared is built before `memory-core` tests:
    - `pnpm --filter @claustrum/shared build`
  - current `memory-core` test script already includes this prebuild step by default
- If CI fails in bootstrap QC:
  - ensure compose profile is `localdb`
  - ensure `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` are set to real values (not placeholder strings like `<db_user>`)
  - ensure `MEMORY_CORE_RUN_SEED=false` (release-gate default) is effective
- If CI fails in webhook QC:
  - confirm `GITHUB_APP_WEBHOOK_SECRET` is present in compose env
- If cleanup fails:
  - run manual cleanup:
    - `docker compose -f docker-compose.dev.yml --profile localdb down -v --remove-orphans`


Last Updated: 2026-02-18
