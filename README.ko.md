# context-sync: 팀 확장형 Memory Core

[English](README.md) | [한국어](README.ko.md)

AI 코딩 에이전트를 위한 프로덕션급 메모리 인프라.

`context-sync`는 Codex/Claude 기반 MCP 워크플로를 실제 팀 환경에서 안정적으로 운영하기 위해 설계되었습니다.

## 주요 특징

- **MCP 안전성 기본 탑재**: stdio 규율 강제 (`stdout`은 JSON-RPC만, 로그는 `stderr`만).
- **팀 확장형 데이터 모델**: workspaces/projects/members/permissions/audit logs 지원.
- **신뢰 가능한 recall**: 기본 리콜은 **memories 중심**으로 정제된 컨텍스트 제공.
- **통제된 raw 접근**: raw 검색은 snippet-only, 길이 제한과 audit 추적 적용.
- **운영 감사 가시성**: audit 이벤트를 Slack으로 전달해 누가/무엇을/왜 변경했는지 추적 가능.
- **외부 문서 컨텍스트 연동**: Notion/Jira/Confluence/Linear read/search로 팀 문서 지식 재활용 가능.
  - Notion/Jira/Confluence/Linear 자격정보는 env뿐 아니라 Admin UI(`/v1/integrations`)에서 워크스페이스별 저장 가능.
- **운영 가능한 배포 경로**: Postgres, migrations/seeds, Docker Compose, 외부 DB 지원.

## 모노레포 앱

- `apps/memory-core`: REST API 서버 (Express + Prisma + Postgres)
- `apps/mcp-adapter`: memory-core REST를 호출하는 MCP stdio adapter
- `apps/admin-ui`: Next.js 운영 대시보드
- `packages/shared`: 공용 스키마/타입

## Compose 모드

- `docker-compose.yml`: 이미지 기반 배포(서버/Dockge 권장)
- `docker-compose.dev.yml`: 소스 빌드 기반 로컬 개발

직접 빌드한 이미지를 쓸 경우 아래 태그를 override:
- `MEMORY_CORE_IMAGE`
- `MCP_ADAPTER_IMAGE`
- `ADMIN_UI_IMAGE`

## 빠른 시작 (로컬 개발, 소스 빌드 컨테이너)

```bash
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yml --profile localdb up -d --build
```

## 빠른 시작 (로컬 프로세스 + DB 컨테이너)

```bash
pnpm install
cp .env.example .env
docker compose --profile localdb up -d postgres
pnpm db:migrate && pnpm db:seed
pnpm dev
```

## 인증 키 (런타임 vs 시드)

- `MEMORY_CORE_API_KEY`
  - `mcp-adapter`/관리 스크립트가 `memory-core`를 호출할 때 쓰는 런타임 Bearer 토큰입니다.
  - env에 설정되어 있으면 `memory-core`가 env-admin 키로도 인증합니다.
- `MEMORY_CORE_SEED_ADMIN_KEY`
  - `pnpm db:seed`에서만 사용되며, DB `api_keys` 테이블의 관리자 키를 생성/갱신(`upsert`)합니다.
  - 값이 없으면 seed는 `MEMORY_CORE_API_KEY`를 fallback으로 사용합니다.

권장:
- 로컬/개발: 두 값을 같은 강한 키로 설정
- 운영: 런타임 키와 seed 키를 분리해 수명주기 관리

## Slack 감사 알림 (누가 / 무엇을 / 왜)

`.env`에 아래 값을 설정하면 audit 이벤트가 Slack으로 비동기 전송됩니다.

```bash
MEMORY_CORE_AUDIT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
MEMORY_CORE_AUDIT_SLACK_ACTION_PREFIXES=workspace_settings.,project_mapping.,integration.
```

Admin UI에서 아래 저장 동작은 `reason`을 함께 전송합니다.
- Resolution settings 저장
- Project mapping 추가/수정
- Integration 저장

Slack 메시지에는 action, workspace, actor, changed fields, reason이 포함됩니다.

이제 Admin UI `Integrations -> Slack Audit`에서 워크스페이스별로 아래를 설정할 수 있습니다.
- action prefix 필터
- 포맷(`detailed` / `compact`)
- 마스킹 + target JSON 포함 여부
- severity rules(`action_prefix -> severity`)
- routing rules(`action_prefix -> channel, min_severity`)

예시 JSON:
```json
{
  "routes": [
    { "action_prefix": "git.", "channel": "#audit-devflow", "min_severity": "medium" },
    { "action_prefix": "integration.", "channel": "#audit-security", "min_severity": "high" }
  ],
  "severity_rules": [
    { "action_prefix": "integration.", "severity": "high" },
    { "action_prefix": "raw.", "severity": "low" }
  ]
}
```

Integration 우선순위 정책:
- 기본: Admin UI의 워크스페이스 설정이 우선이고, env 값은 fallback으로 사용됩니다.
- 선택적 잠금: `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=notion,jira,confluence,linear,slack`(부분 지정 가능)로 지정한 provider를 env-only 모드로 강제할 수 있습니다.
- 잠금된 provider는 Admin UI에서 읽기 전용으로 보이며, 서버에서도 업데이트 요청을 거부합니다.

## Git Hook Audit + 자동 Write

- Admin UI Integrations에서 provider별 체크박스로 설정:
  - `auto write on commit hook`
  - `auto write on merge hook`
- context-sync 툴에서 아래로 git hook 설치:
  - `set_project({ key: "...", enable_git_hooks: true })`
- git hook 이벤트(`post-commit`, `post-merge`)는 `memory-core /v1/git-events`로 전달됩니다.
- `memory-core`는 `git.commit` / `git.merge` audit 로그를 기록하고, Slack 설정 시 자동 전송합니다.
- Notion: hook auto-write가 켜져 있으면 해당 이벤트 시 자동 Notion write를 시도합니다.
- Jira/Confluence/Linear: 현재는 hook 트리거 + audit 경로까지 지원하며, provider write는 단계적으로 확장합니다.

## 외부 DB (RDS 등)

```bash
cp .env.example .env
# DATABASE_URL을 외부 Postgres로 설정 (예: sslmode=require 포함)
docker compose up -d
```

## Dockge (이미지 기반)

```bash
cp .env.example .env
# DATABASE_URL + MEMORY_CORE_API_KEY + MEMORY_CORE_SEED_ADMIN_KEY 설정
# MEMORY_CORE_IMAGE / MCP_ADAPTER_IMAGE / ADMIN_UI_IMAGE를 publish된 태그로 지정
docker compose up -d
```

## 이미지 태그 발행 (GHCR)

이 리포에는 `.github/workflows/docker-publish.yml`가 포함되어 있습니다.

- 트리거:
  - `main` 푸시 -> `latest` + `sha-<short>` 태그 발행
  - `v*` 태그 푸시 -> 버전 태그 발행 (예: `v0.1.0`)
- 발행 이미지:
  - `ghcr.io/<owner>/context-sync-memory-core:<tag>`
  - `ghcr.io/<owner>/context-sync-mcp-adapter:<tag>`
  - `ghcr.io/<owner>/context-sync-admin-ui:<tag>`

릴리즈 예시:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## 문서 / 위키

상세 설치/운영 문서는 위키형 문서로 관리합니다.

- GitHub Wiki: <https://github.com/stephen-kim/context-sync/wiki>
- 위키 원본 문서(로컬):
  - `docs/wiki/Home.ko.md`
  - `docs/wiki/Installation.ko.md`
  - `docs/wiki/Operations.ko.md`
  - `docs/wiki/Security-and-MCP-IO.ko.md`
  - `docs/wiki/Notion-Integration.ko.md`
  - `notion_context` MCP 부트스트랩 플로우(`search -> snippet read`) 포함
  - `docs/wiki/Atlassian-Integration.ko.md`
  - Jira 이슈 + Confluence 문서 컨텍스트 검색/열람 및 감사 로그
  - `docs/wiki/Linear-Integration.ko.md`
  - Linear 이슈 컨텍스트 검색/열람 및 감사 로그

## Codex MCP 설정 예시

`~/.codex/config.toml`

```toml
[mcp_servers.memory-core]
command = "pnpm"
args = ["--filter", "@context-sync/mcp-adapter", "start"]

[mcp_servers.memory-core.env]
MEMORY_CORE_URL = "http://127.0.0.1:8080"
MEMORY_CORE_API_KEY = "<강한-런타임-키>"
MEMORY_CORE_WORKSPACE_KEY = "personal"
MCP_ADAPTER_LOG_LEVEL = "error"
```

## 포크 정보

현재 git remote 기준:
- Fork (`origin`): `https://github.com/stephen-kim/context-sync.git`
- Upstream (`upstream`): `https://github.com/Intina47/context-sync.git`
