# Dependency Management (pnpm Standard)


## Policy

Claustrum uses **pnpm** as the official package manager.

Rules:
- Use `pnpm` for install/run/update.
- Commit `pnpm-lock.yaml`.
- Do not commit `package-lock.json` or `yarn.lock`.
- CI must use `pnpm install --frozen-lockfile`.
- Do not run `npm install` in this repository.


## Why pnpm

- Deterministic workspace installs via a single lockfile.
- Fast, disk-efficient dependency storage.
- Better monorepo workflow with recursive commands.


## Lockfile Policy

Required:
- `pnpm-lock.yaml` is source-controlled.

Forbidden:
- `package-lock.json`
- `yarn.lock`

If an npm lockfile appears accidentally, remove it and reinstall with pnpm.


## Workspace Layout

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```


## Root Commands

- `pnpm dev` → `pnpm -r dev`
- `pnpm build` → `pnpm -r build`
- `pnpm lint` → `pnpm -r lint`
- `pnpm test` → `pnpm -r test`


## CI Rules

CI must run:

1. Setup pnpm + Node
2. `pnpm install --frozen-lockfile`
3. `pnpm lint`
4. `pnpm build`
5. `pnpm test`


## Local Development

```bash
pnpm install
pnpm dev
```

Use package filters when needed:

```bash
pnpm --filter @claustrum/memory-core dev
pnpm --filter @claustrum/admin-ui build
```


## Guardrails

`.npmrc` enforces:

```ini
engine-strict=true
auto-install-peers=true
```

