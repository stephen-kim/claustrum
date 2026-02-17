# 설치 가이드


## 사전 요구사항

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+ (로컬 컨테이너 또는 외부 DB)
- Docker / Docker Compose (로컬 부트스트랩 권장)


## 환경변수

DB 원칙:
- `memory-core`는 `DATABASE_URL`만 사용
- `POSTGRES_*`는 로컬 compose postgres 초기화용

주요 변수:
- `DATABASE_URL`
- `MEMORY_CORE_API_KEY` 또는 `MEMORY_CORE_API_KEYS`
- `MEMORY_CORE_SEED_ADMIN_KEY`
- `MEMORY_CORE_URL`
- `MEMORY_CORE_WORKSPACE_KEY`
- `NEXT_PUBLIC_MEMORY_CORE_URL`


### API 키 변수 (중요)

- `MEMORY_CORE_API_KEY`
  - 런타임 Bearer 토큰입니다. (mcp-adapter/관리 스크립트가 memory-core 호출 시 사용)
  - 이 값이 env에 있으면 memory-core는 env-admin 키로도 인식합니다.
- `MEMORY_CORE_SEED_ADMIN_KEY`
  - `pnpm db:seed` 실행 시 DB `api_keys` 테이블에 관리자 키를 생성/갱신(`upsert`)할 때만 사용합니다.
  - 값이 없으면 seed가 `MEMORY_CORE_API_KEY`를 fallback으로 사용합니다.

Upsert 의미:
- 키가 없으면 insert(생성)
- 이미 있으면 update(갱신)
- 그래서 `db:seed`를 여러 번 실행해도 안전합니다(idempotent).

권장:
- 로컬/개발: 두 값을 동일한 강한 키로 설정
- 운영: 런타임 `MEMORY_CORE_API_KEY`와 seed용 `MEMORY_CORE_SEED_ADMIN_KEY`를 분리해 관리


## Compose 파일

- `docker-compose.yml`: 이미지 기반 배포(Dockge/서버)
- `docker-compose.dev.yml`: 소스 빌드 기반 로컬 개발
- 이미지 override 변수(선택): `MEMORY_CORE_IMAGE`, `MCP_ADAPTER_IMAGE`, `ADMIN_UI_IMAGE`
- 기본 이미지:
  - `ghcr.io/stephen-kim/claustrum-memory-core:latest`
  - `ghcr.io/stephen-kim/claustrum-mcp-adapter:latest`
  - `ghcr.io/stephen-kim/claustrum-admin-ui:latest`


## 로컬 개발 (소스 빌드 컨테이너)

```bash
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yml --profile localdb up -d --build
```

기본 엔드포인트:
- memory-core: `http://localhost:8080`
- admin-ui: `http://localhost:3000`


## 로컬 개발 (로컬 프로세스 + DB 컨테이너)

```bash
pnpm install
cp .env.example .env
docker compose --profile localdb up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```


## 외부 DB (RDS 등)

1. env 파일 복사:

```bash
cp .env.example .env
```

2. 외부 DB URL 설정:

```bash
DATABASE_URL=postgres://<user>:<pass>@<rds-endpoint>:5432/<db>?sslmode=require
```

3. localdb profile 없이 실행:

```bash
docker compose up -d
```


## Docker 주의사항

- 컨테이너 내부 통신은 `localhost` 대신 서비스명 사용(`memory-core`, `postgres`)
- 브라우저용 URL(`NEXT_PUBLIC_MEMORY_CORE_URL`)은 `localhost` 또는 실제 도메인 사용


## Codex MCP 어댑터 설정

`~/.codex/config.toml`

```toml
[mcp_servers.memory-core]
command = "pnpm"
args = ["--filter", "@claustrum/mcp-adapter", "start"]

[mcp_servers.memory-core.env]
MEMORY_CORE_URL = "http://127.0.0.1:8080"
MEMORY_CORE_API_KEY = "<runtime-api-key>"
MEMORY_CORE_WORKSPACE_KEY = "personal"
MCP_ADAPTER_LOG_LEVEL = "error"
```
