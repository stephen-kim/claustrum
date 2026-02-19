# インストール

## 前提条件

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+
- Docker / Docker Compose（推奨）

## 重要なルール

- `memory-core` は DB 接続に `DATABASE_URL` のみ使用します。
- `POSTGRES_*` は localdb（Postgres 初期化）専用です。

詳細は [環境変数](environment-variables) を参照してください。

## 最小環境変数

- `DATABASE_URL`
- `MEMORY_CORE_API_KEY`
- `MEMORY_CORE_URL`
- `NEXT_PUBLIC_MEMORY_CORE_URL`
- localdb を使う場合: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

推奨:

- `MEMORY_CORE_SECRET`

## ローカル開発（ソースビルド）

```bash
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yml --profile localdb up -d --build
```

## ローカル開発（ローカルプロセス + DB コンテナ）

```bash
pnpm install
cp .env.example .env
docker compose --profile localdb up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## 外部 DB（RDS など）

```bash
cp .env.example .env
# .env の DATABASE_URL を外部 DB に変更
# 例: postgres://user:pass@host:5432/db?sslmode=require
docker compose up -d
```

## MCP 設定ヘルパー

```bash
pnpm mcp:helper
```

またはワンライナー:

```bash
curl -fsSL https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -o ./claustrum-mcp-config-helper.js && node ./claustrum-mcp-config-helper.js
```
