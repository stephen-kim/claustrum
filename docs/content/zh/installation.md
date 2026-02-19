# 安装

## 前置要求

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+
- Docker / Docker Compose（推荐）

## 关键规则

- `memory-core` 连接数据库只使用 `DATABASE_URL`。
- `POSTGRES_*` 仅用于 localdb 初始化。

更多变量说明见 [环境变量](environment-variables)。

## 最小环境变量

- `DATABASE_URL`
- `MEMORY_CORE_API_KEY`
- `MEMORY_CORE_URL`
- `NEXT_PUBLIC_MEMORY_CORE_URL`
- 使用 localdb 时：`POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD`

推荐：

- `MEMORY_CORE_SECRET`

## 本地开发（源码构建容器）

```shell
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yml --profile localdb up -d --build
```markdown

## 本地开发（本地进程 + DB 容器）

```shell
pnpm install
cp .env.example .env
docker compose --profile localdb up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## 外部数据库（RDS 等）

```shell
cp .env.example .env
# 将 DATABASE_URL 改为外部数据库
# 例: postgres://user:pass@host:5432/db?sslmode=require
docker compose up -d
```markdown

## MCP 配置助手

```shell
pnpm mcp:helper
```

或一行执行：

```shell
curl -fsSL https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -o ./claustrum-mcp-config-helper.js && node ./claustrum-mcp-config-helper.js
```text
