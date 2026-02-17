FROM node:20-bookworm-slim

WORKDIR /workspace
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/mcp-adapter/package.json apps/mcp-adapter/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --no-frozen-lockfile --ignore-scripts

COPY apps/mcp-adapter apps/mcp-adapter
COPY packages/shared packages/shared

RUN pnpm --filter @claustrum/shared build
RUN pnpm --filter @claustrum/mcp-adapter build

WORKDIR /workspace/apps/mcp-adapter
CMD ["pnpm", "start"]
