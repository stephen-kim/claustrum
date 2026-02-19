# Contributing

Thanks for contributing to Claustrum.


## Development Setup

```shell
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```


## Before Opening a PR

- Run `pnpm build:workspace`
- Run `pnpm test:workspace`
- Update docs when behavior/config changes
- Keep MCP stdout clean (`stdout` JSON-RPC only)


## Commit Style

Use Conventional Commits when possible:

- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `chore:`
