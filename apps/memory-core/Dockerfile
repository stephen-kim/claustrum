FROM node:20-bookworm-slim

WORKDIR /workspace
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl libssl3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/memory-core/package.json apps/memory-core/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --no-frozen-lockfile --ignore-scripts

COPY apps/memory-core apps/memory-core
COPY packages/shared packages/shared

RUN pnpm --filter @claustrum/shared build
RUN pnpm --filter @claustrum/memory-core build

WORKDIR /workspace/apps/memory-core
CMD ["pnpm", "start:http"]
