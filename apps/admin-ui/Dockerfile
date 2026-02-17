FROM node:20-bookworm-slim

WORKDIR /workspace
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/admin-ui/package.json apps/admin-ui/package.json

RUN pnpm install --no-frozen-lockfile --ignore-scripts

COPY apps/admin-ui apps/admin-ui

RUN pnpm --filter @claustrum/admin-ui build

WORKDIR /workspace/apps/admin-ui
CMD ["pnpm", "start"]
