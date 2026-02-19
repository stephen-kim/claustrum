# Guía de CI

Claustrum ejecuta release gate en cada PR y en cada push a `main`.

## Flujo principal

- Archivo: `.github/workflows/ci.yml`
- Triggers: `pull_request`, `push` en `main`
- Job: `release-gate` (`ubuntu-latest`, `timeout-minutes: 20`)

Secuencia:

1. checkout
2. setup Node 20 + pnpm
3. `pnpm install --frozen-lockfile`
4. preparar `.env` para CI
5. `pnpm lint`
6. `pnpm test`
7. `RELEASE_GATE_RESET_DB=true ./scripts/release-gate.sh`
8. cleanup siempre: `docker compose ... down -v --remove-orphans`

## Flujo de Docs Pages

- Archivo: `.github/workflows/docs-pages.yml`

Puntos clave:
- genera OpenAPI antes del build de docs
- valida spec generado antes de publicar
- explorer API en `/docs/api` (Scalar)

Requisitos iniciales:
1. activar Pages en Settings
2. source de deploy: GitHub Actions

## Flujo de Eval Comment

- Archivo: `.github/workflows/eval-comment.yml`

Hace:
- eval de context bundle por PR
- sticky comment con score/fallos/diff
- schema snapshot guard para MCP tools
- sube artifacts aunque falle guard

## Repro local

```bash
RELEASE_GATE_RESET_DB=true ./scripts/release-gate.sh
```

## Troubleshooting rápido

- `ERR_MODULE_NOT_FOUND @claustrum/shared/dist/index.js`:
  - correr `pnpm --filter @claustrum/shared build`
- falla bootstrap QC:
  - revisar profile `localdb` y variables Postgres
- falla webhook QC:
  - revisar `GITHUB_APP_WEBHOOK_SECRET`

Última actualización: 2026-02-19
