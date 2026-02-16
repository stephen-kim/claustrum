FROM node:20-bookworm-slim

WORKDIR /workspace
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/memory-core/package.json apps/memory-core/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --no-frozen-lockfile --ignore-scripts

COPY apps/memory-core apps/memory-core
COPY packages/shared packages/shared

RUN pnpm --filter @context-sync/shared build
RUN pnpm --filter @context-sync/memory-core build

WORKDIR /workspace/apps/memory-core
CMD ["pnpm", "start:http"]
