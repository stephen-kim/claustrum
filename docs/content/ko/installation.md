# 설치

## 준비 사항

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+ (로컬 컨테이너 또는 외부 DB)
- Docker / Docker Compose (권장)

## 먼저 알아둘 규칙

- `memory-core`는 DB 연결에 `DATABASE_URL`만 사용합니다.
- `POSTGRES_*` 변수는 localdb(Postgres 컨테이너 초기화) 전용입니다.
- 상세 변수는 [환경 변수](environment-variables) 문서를 참고하세요.

최소 실행 변수:

- `DATABASE_URL`
- `MEMORY_CORE_API_KEY`
- `MEMORY_CORE_URL`
- `NEXT_PUBLIC_MEMORY_CORE_URL`
- localdb 사용 시: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

권장 보안 변수:

- `MEMORY_CORE_SECRET`

## API 키 변수 설명

- `MEMORY_CORE_API_KEY`
  - 런타임 호출용 키입니다(mcp-adapter, 스크립트, 클라이언트).
- `MEMORY_CORE_SEED_ADMIN_KEY`
  - `pnpm db:seed` 시 `api_keys`에 admin 키를 upsert할 때만 사용합니다.
  - 비워두면 `MEMORY_CORE_API_KEY`를 사용합니다.

`upsert` 의미:

- 없으면 생성
- 있으면 업데이트
- seed를 여러 번 실행해도 안전(idempotent)

## Compose 파일 구분

- `docker-compose.yml`: 이미지 기반 배포(Dockge/서버)
- `docker-compose.dev.yml`: 소스 빌드 기반 로컬 개발

이미지 기본값:

- `ghcr.io/stephen-kim/claustrum-memory-core:latest`
- `ghcr.io/stephen-kim/claustrum-mcp-adapter:latest`
- `ghcr.io/stephen-kim/claustrum-admin-ui:latest`

필요하면 다음으로 오버라이드할 수 있습니다.

- `MEMORY_CORE_IMAGE`
- `MCP_ADAPTER_IMAGE`
- `ADMIN_UI_IMAGE`

## 로컬 개발: 소스 빌드 컨테이너

```bash
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yml --profile localdb up -d --build
```

접속 주소:

- memory-core: `http://localhost:8080`
- admin-ui: `http://localhost:3000`

## 로컬 개발: 로컬 프로세스 + DB 컨테이너

```bash
pnpm install
cp .env.example .env
docker compose --profile localdb up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## 외부 DB(RDS 등) 사용

1. 환경 파일 복사

```bash
cp .env.example .env
```

2. `DATABASE_URL`을 외부 DB로 설정

```bash
DATABASE_URL=postgres://<user>:<pass>@<rds-endpoint>:5432/<db>?sslmode=require
```

3. localdb profile 없이 실행

```bash
docker compose up -d
```

## Docker 네트워크 주의사항

- 컨테이너 내부 통신은 `localhost`가 아니라 서비스명(`memory-core`, `postgres`)을 사용합니다.
- 브라우저에서 접근하는 URL(`NEXT_PUBLIC_MEMORY_CORE_URL`)은 `localhost` 또는 실제 도메인을 사용합니다.

## Codex MCP 설정 예시

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

## 수동 MCP 설정 (자동 구성 CLI 없이)

```toml
[mcp_servers.claustrum]
command = "node"
args = ["/absolute/path/to/claustrum/apps/mcp-adapter/dist/index.js"]

[mcp_servers.claustrum.env]
MEMORY_CORE_URL = "http://127.0.0.1:8080"
MEMORY_CORE_API_KEY = "<runtime-api-key>"
MEMORY_CORE_WORKSPACE_KEY = "personal"
MCP_ADAPTER_LOG_LEVEL = "error"
```

참고:

- 위 `dist` 경로를 쓰려면 먼저 빌드가 필요합니다.
  - `pnpm --filter @claustrum/mcp-adapter build`
- `stdout`에는 JSON-RPC만 나가야 합니다(로그는 `stderr`).

## MCP 구성 헬퍼(선택)

대화형 헬퍼 실행:

```bash
pnpm mcp:helper
```

기능:

- 여러 클라이언트 선택 (Space 토글, 화살표 이동)
- 지원 클라이언트: Codex, Claude Code, Cursor, Antigravity
- adapter command/args 입력
- 기존 설정 파일 자동 백업
- 적용 후 클라이언트 재시작 안내

원라인 실행:

```bash
curl -fsSL https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -o ./claustrum-mcp-config-helper.js && node ./claustrum-mcp-config-helper.js
```

Windows PowerShell:

```powershell
iwr https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -OutFile .\claustrum-mcp-config-helper.js; node .\claustrum-mcp-config-helper.js
```
