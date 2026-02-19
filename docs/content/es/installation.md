# Instalación

## Requisitos

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+
- Docker / Docker Compose (recomendado)

## Reglas clave

- `memory-core` usa solo `DATABASE_URL` para conectarse a la base de datos.
- `POSTGRES_*` se usa únicamente para inicializar Postgres en `localdb`.

Más detalle en [Variables de entorno](environment-variables).

## Variables mínimas

- `DATABASE_URL`
- `MEMORY_CORE_API_KEY`
- `MEMORY_CORE_URL`
- `NEXT_PUBLIC_MEMORY_CORE_URL`
- si usas `localdb`: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

Recomendado:

- `MEMORY_CORE_SECRET`

## Desarrollo local (source build)

```shell
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yml --profile localdb up -d --build
```

## Desarrollo local (procesos locales + DB en contenedor)

```shell
pnpm install
cp .env.example .env
docker compose --profile localdb up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Base de datos externa (RDS, etc.)

```shell
cp .env.example .env
# Cambia DATABASE_URL a tu endpoint externo
# Ejemplo: postgres://user:pass@host:5432/db?sslmode=require
docker compose up -d
```

## Asistente MCP

```shell
pnpm mcp:helper
```

O en una línea:

```shell
curl -fsSL https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -o ./claustrum-mcp-config-helper.js && node ./claustrum-mcp-config-helper.js
```
