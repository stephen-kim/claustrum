# Claustrum

Claustrum은 AI 시스템을 위한 공유 메모리 계층입니다. 프로젝트, 도구, 팀 전반의 컨텍스트를 통합합니다.

Claustrum은 MCP 기반 AI 개발 워크플로를 운영 환경에서 안정적으로 실행하기 위한 메모리 인프라를 제공합니다.


## 핵심 구성요소

- **Memory Core**: REST API, 인증/정책, Postgres 저장소.
- **MCP Adapter**: Memory Core를 HTTP로 호출하는 stdio MCP 서버 (`stdout` JSON-RPC only).
- **Admin UI**: 워크스페이스/프로젝트/메모리/임포트/연동/감사 로그 관리 대시보드.
- **Shared Package**: 공용 스키마, 타입, 유틸리티.


## 모노레포 구조

```text
apps/
  memory-core/
  mcp-adapter/
  admin-ui/
packages/
  shared/
infra/
  docker-compose.yml
```

인프라 매니페스트는 `infra/docker-compose.yml`에도 미러링되어 있습니다.
실제 실행용 compose 파일은 루트(`docker-compose.yml`, `docker-compose.dev.yml`)를 기본으로 사용합니다.


## 아키텍처

상세 아키텍처/데이터 모델 다이어그램:

- `docs/architecture.md`


## 프로젝트 해석과 메모리 스코프

기본 프로젝트 해석 우선순위:

1. `github_remote`
2. `repo_root_slug`
3. `manual`

모노레포 subproject key는 **경로 기반**입니다 (`package.json` name 기반 아님):

- repo key: `github:owner/repo`
- subproject key: `github:owner/repo#apps/memory-core`

자동 전환 기본값:

- `auto_switch_repo=true`
- `auto_switch_subproject=false`
- `enable_monorepo_resolution=false`
- `monorepo_detection_level=2`

Pin 모드 도구:

- `set_project({ key })`
- `unset_project_pin()`
- `get_current_project()`


## Git Event Capture

Claustrum은 git 라이프사이클 이벤트를 raw 운영 시그널로 저장할 수 있습니다.

- `post-commit` (기본 활성화)
- `post-merge` (기본 활성화)
- `post-checkout` (기본 비활성, 옵션)

정책은 **Admin UI > Project Resolution Settings > Git Events**에서 설정합니다.

- `enable_git_events`
- `enable_commit_events`
- `enable_merge_events`
- `enable_checkout_events`
- `checkout_debounce_seconds`
- `checkout_daily_limit`

안전 정책:

- `pre-push`는 의도적으로 지원하지 않습니다.
- 훅은 비동기 fire-and-forget(`&`) + 항상 `exit 0`입니다.
- 훅 실패가 git 동작을 막지 않습니다.
- 훅 스크립트는 `>/dev/null 2>&1`로 출력 노이즈를 차단합니다.

API:

- `POST /v1/raw-events`
- `GET /v1/raw-events`
- `POST /v1/git-events` (레거시 호환 alias, 내부적으로 raw events로 매핑)


## Quickstart (localdb)

```bash
cp .env.example .env
docker compose --profile localdb up -d
pnpm db:migrate && pnpm db:seed
```


## Quickstart (external DB)

1. env 템플릿 복사:

```bash
cp .env.example .env
```

2. `DATABASE_URL`에 외부 DB(RDS 등) 설정:

```bash
DATABASE_URL=postgres://<user>:<pass>@<rds-endpoint>:5432/<db>?sslmode=require
```

3. localdb profile 없이 실행:

```bash
docker compose up -d
```


## Docker 네트워킹 주의사항

- localdb 프로파일에서 컨테이너 내부 `DATABASE_URL` host는 `postgres`(서비스명)여야 합니다.
- `MEMORY_CORE_URL`은 컨테이너 내부 호출 주소(일반적으로 `http://memory-core:8080`)입니다.
- `NEXT_PUBLIC_MEMORY_CORE_URL`은 브라우저 접근 가능한 주소여야 합니다 (`http://localhost:8080` 또는 도메인).


## 개발 워크플로

```bash
pnpm install
pnpm build:workspace
pnpm test:workspace
pnpm dev
```


## 문서

- `docs/architecture.md`
- `docs/wiki/Home.ko.md`
- `docs/wiki/Installation.ko.md`
- `docs/wiki/Operations.ko.md`
- `docs/wiki/Security-and-MCP-IO.ko.md`


## Upstream

- Upstream (`upstream`): `https://github.com/Intina47/context-sync.git`
