# 환경 변수(전체 참조)

## 목적

`.env.example`은 빠른 설정을 위해 의도적으로 최소화되었습니다.

이 페이지는 다음에 대한 전체 환경 변수 참조입니다.

- `apps/memory-core`
- `apps/mcp-adapter`
- `apps/admin-ui`
- Docker Compose 배포
- 선택적인 CI 워크플로
- 선택적 저장소 스크립트(`scripts/`)

## 우선순위 규칙

- `memory-core` 데이터베이스 연결은 `DATABASE_URL`만 사용합니다.
- `POSTGRES_*` 값은 로컬 Compose Postgres 부트스트랩에만 사용됩니다.
- 통합의 경우(Notion/Jira/Confluence/Linear/Slack/Audit Reasoner):
  - 관리 UI에서 값을 DB에 저장할 수 있습니다.
  - env를 통해 제공,
  - `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS`은 어떤 소스가 승리할지 제어합니다.

## 빠른 시작 최소

- `DATABASE_URL`
- `MEMORY_CORE_API_KEY`
- `MEMORY_CORE_URL`
- `NEXT_PUBLIC_MEMORY_CORE_URL`
- 선택적 편의: `COMPOSE_PROFILES=localdb`(로컬 postgres 프로필 자동 활성화)
- 로컬 DB 프로필만 해당: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

## 메모리 코어(필수/코어)

| 변수 | 필수 | 기본값 | 메모 |
|---|---|---|---|
| `DATABASE_URL` | 예 | 없음 | 포스트그레스 DSN. RDS의 경우 SSL 쿼리(`sslmode=require` 등)를 포함합니다. |
| `MEMORY_CORE_API_KEY` | 추천 | 없음 | 클라이언트용 런타임 전달자 토큰입니다. |
| `MEMORY_CORE_API_KEYS` | 아니요 | 비어 있음 | 쉼표로 구분된 추가 런타임 키입니다. |
| `MEMORY_CORE_HOST` | 아니요 | `0.0.0.0` | HTTP 바인드 호스트. |
| `MEMORY_CORE_PORT` | 아니요 | `8080` | HTTP 바인드 포트. |
| `MEMORY_CORE_LOG_LEVEL` | 아니요 | `error` | `debug`, `info`, `warn`, `error`, `silent`. |

빠른 실패 검증:
- memory-core는 시작 시 핵심 환경 값을 검증합니다(Zod 기반).
- 잘못된 필수 값(예: 빈 `DATABASE_URL` 또는 잘못된 포트 범위)은 트래픽을 제공하기 전에 빠르게 실패합니다.

## 메모리 코어(부트스트랩/인증/보안)

| 변수 | 필수 | 기본값 | 메모 |
|---|---|---|---|
| `MEMORY_CORE_ALLOW_BOOTSTRAP_ADMIN` | 아니요 | `true` | DB에 사용자가 없으면 부트스트랩 `admin@example.com`을 한 번 생성합니다. |
| `MEMORY_CORE_SEED_ADMIN_KEY` | 아니요 | `MEMORY_CORE_API_KEY`으로 복귀 | `pnpm db:seed`에서만 사용됩니다. |
| `MEMORY_CORE_SECRET` | 추천 | 개발 대체 | 공유 기본 비밀입니다. 생산에 적극 권장됩니다. |
| `MEMORY_CORE_AUTH_SESSION_SECRET` | 아니요 | `MEMORY_CORE_SECRET` 또는 개발자 대체에서 파생됨 | 세션 서명 비밀을 재정의합니다. |
| `MEMORY_CORE_AUTH_SESSION_TTL_SECONDS` | 아니요 | `43200` | 세션 TTL 초(최소 클램프 적용) |
| `MEMORY_CORE_API_KEY_HASH_SECRET` | 아니요 | `MEMORY_CORE_SECRET` 또는 개발자 대체에서 파생됨 | API 키 해싱 비밀 재정의. |
| `MEMORY_CORE_ONE_TIME_TOKEN_SECRET` | 아니요 | 공유 비밀/세션 비밀에서 파생 | 일회성 링크 토큰 비밀 재정의. |
| `MEMORY_CORE_ONE_TIME_TOKEN_TTL_SECONDS` | 아니요 | `900` | 일회성 토큰 TTL 초입니다. |
| `MEMORY_CORE_GITHUB_STATE_SECRET` | 아니요 | 공유 비밀/세션 비밀에서 파생 | GitHub 콜백 상태 서명 비밀입니다. |
| `MEMORY_CORE_PUBLIC_BASE_URL` | 아니요 | 비어 있음 | 콜백/링크 생성에 사용되는 공개 기본 URL입니다. |
| `MEMORY_CORE_INVITE_BASE_URL` | 아니요 | 비어 있음 | URL 기반 재정의를 초대합니다. |

## 메모리 코어(GitHub 앱)

| 변수 | 필수 | 기본값 | 메모 |
|---|---|---|---|
| `GITHUB_APP_ID` | 선택사항 | 비어 있음 | GitHub 앱 ID. |
| `GITHUB_APP_PRIVATE_KEY` | 선택사항 | 비어 있음 | 원시 PEM, 이스케이프된 줄바꿈 또는 base64 PEM을 지원합니다. |
| `GITHUB_APP_WEBHOOK_SECRET` | 선택사항 | 비어 있음 | GitHub Webhook 서명 확인 비밀입니다. |
| `GITHUB_APP_NAME` | 선택사항 | 비어 있음 | UI/메타데이터 도우미. |
| `GITHUB_APP_URL` | 선택사항 | 비어 있음 | UI/메타데이터 도우미. |

## 메모리 코어(통합 소스 제어)

| 변수 | 필수 | 기본값 | 메모 |
|---|---|---|---|
| `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS` | 아니요 | 비어 있음 | `all`, `none` 또는 제공자 목록: `notion,jira,confluence,linear,slack,audit_reasoner`. |

행동:

- `all`: 모든 공급자에 대해 ENV 전용을 강제합니다.
- `none`: ENV 공급자 구성을 무시하고 DB/Admin UI 구성만 사용합니다.
- CSV 목록: 나열된 공급자에 대해 ENV 전용을 강제합니다.

## 메모리 코어(Audit Slack)

| 변수 | 필수 | 기본값 | 메모 |
|---|---|---|---|
| `MEMORY_CORE_AUDIT_SLACK_WEBHOOK_URL` | 선택사항 | 비어 있음 | 감사 전달을 위한 Slack 웹훅 엔드포인트입니다. |
| `MEMORY_CORE_AUDIT_SLACK_ACTION_PREFIXES` | 선택사항 | 비어 있음 | CSV 접두사 필터(예: `access.,auth.`). |
| `MEMORY_CORE_AUDIT_SLACK_DEFAULT_CHANNEL` | 선택사항 | 비어 있음 | 선택적 채널 재정의. |
| `MEMORY_CORE_AUDIT_SLACK_FORMAT` | 선택사항 | `detailed` | `compact` 또는 `detailed`. |
| `MEMORY_CORE_AUDIT_SLACK_INCLUDE_TARGET_JSON` | 선택사항 | `true` | 대상 페이로드 세부정보를 포함합니다. |
| `MEMORY_CORE_AUDIT_SLACK_MASK_SECRETS` | 선택사항 | `true` | 비밀과 유사한 값을 마스크합니다. |
| `MEMORY_CORE_ALLOW_PRIVATE_AUDIT_SINK_URLS` | 선택사항 | `false` | 비공개 싱크 URL에 대한 개발자 전용 탈출구입니다. |

## 메모리 코어 (Notion / Jira / Confluence / Linear)

| 변수 | 필수 | 기본값 | 메모 |
|---|---|---|---|
| `MEMORY_CORE_NOTION_TOKEN` | 선택사항 | 비어 있음 | Notion API 토큰. |
| `MEMORY_CORE_NOTION_DEFAULT_PARENT_PAGE_ID` | 선택사항 | 비어 있음 | 쓰기를 위한 기본 상위 페이지입니다. |
| `MEMORY_CORE_NOTION_WRITE_ENABLED` | 선택사항 | `false` | Notion 쓰기 작업을 활성화합니다. |
| `MEMORY_CORE_JIRA_BASE_URL` | 선택사항 | 비어 있음 | Jira 기본 URL. |
| `MEMORY_CORE_JIRA_EMAIL` | 선택사항 | 비어 있음 | Jira 사용자 이메일. |
| `MEMORY_CORE_JIRA_API_TOKEN` | 선택사항 | 비어 있음 | Jira API 토큰. |
| `MEMORY_CORE_CONFLUENCE_BASE_URL` | 선택사항 | 비어 있음 | Confluence 기본 URL. |
| `MEMORY_CORE_CONFLUENCE_EMAIL` | 선택사항 | 비어 있음 | Confluence 사용자 이메일. |
| `MEMORY_CORE_CONFLUENCE_API_TOKEN` | 선택사항 | 비어 있음 | Confluence API 토큰. |
| `MEMORY_CORE_LINEAR_API_KEY` | 선택사항 | 비어 있음 | 선형 API 키. |
| `MEMORY_CORE_LINEAR_API_URL` | 선택사항 | 비어 있음 | 선형 API URL 재정의. |

## 메모리 코어(감사 추론기/LLM)

| 변수 | 필수 | 기본값 | 메모 |
|---|---|---|---|
| `MEMORY_CORE_AUDIT_REASONER_ENABLED` | 선택사항 | 자동 | 설정하지 않으면 제공업체 키가 존재할 때 자동으로 활성화됩니다. |
| `MEMORY_CORE_AUDIT_REASONER_PROVIDER_ORDER` | 선택사항 | `openai,claude,gemini` | CSV 대체 순서. |
| `MEMORY_CORE_AUDIT_REASONER_PROVIDER` | 선택사항(레거시) | 비어 있음 | 레거시 단일 공급자 선택기. |
| `MEMORY_CORE_AUDIT_REASONER_MODEL` | 선택사항(레거시) | 비어 있음 | 레거시 일반 모델(첫 번째 공급자에 적용) |
| `MEMORY_CORE_AUDIT_REASONER_API_KEY` | 선택사항(레거시) | 비어 있음 | 레거시 일반 키(첫 번째 공급자에 적용) |
| `MEMORY_CORE_AUDIT_REASONER_BASE_URL` | 선택사항(레거시) | 비어 있음 | 레거시 일반 기본 URL(첫 번째 공급자에 적용) |
| `MEMORY_CORE_AUDIT_REASONER_OPENAI_MODEL` | 선택사항 | 비어 있음 | OpenAI 모델 재정의. |
| `MEMORY_CORE_AUDIT_REASONER_OPENAI_API_KEY` | 선택사항 | 비어 있음 | OpenAI API 키. |
| `MEMORY_CORE_AUDIT_REASONER_OPENAI_BASE_URL` | 선택사항 | 비어 있음 | OpenAI 기본 URL 재정의. |
| `MEMORY_CORE_AUDIT_REASONER_CLAUDE_MODEL` | 선택사항 | 비어 있음 | 클로드 모델 재정의. |
| `MEMORY_CORE_AUDIT_REASONER_CLAUDE_API_KEY` | 선택사항 | 비어 있음 | 클로드 API 키. |
| `MEMORY_CORE_AUDIT_REASONER_CLAUDE_BASE_URL` | 선택사항 | 비어 있음 | 클로드 기본 URL 재정의. |
| `MEMORY_CORE_AUDIT_REASONER_GEMINI_MODEL` | 선택사항 | 비어 있음 | Gemini 모델 재정의. |
| `MEMORY_CORE_AUDIT_REASONER_GEMINI_API_KEY` | 선택사항 | 비어 있음 | Gemini API 키. |
| `MEMORY_CORE_AUDIT_REASONER_GEMINI_BASE_URL` | 선택사항 | 비어 있음 | Gemini 기본 URL 재정의. |
| `OPENAI_API_KEY` | 선택적 대체 | 비어 있음 | OpenAI 대체 키. |
| `ANTHROPIC_API_KEY` | 선택적 대체 | 비어 있음 | 클로드 대체 키. |
| `CLAUDE_API_KEY` | 선택적 대체 | 비어 있음 | Claude 대체 키 별칭입니다. |
| `GEMINI_API_KEY` | 선택적 대체 | 비어 있음 | Gemini 대체 키. |
| `MEMORY_CORE_CLAUDE_API_KEY` | 선택적 대체 | 비어 있음 | 레거시 Claude 대체 키. |

## MCP 어댑터

| 변수 | 필수 | 기본값 | 메모 |
|---|---|---|---|
| `MEMORY_CORE_URL` | 예 | 없음 | 메모리 코어 기본 URL을 가리켜야 합니다. |
| `MEMORY_CORE_API_KEY` | 예 | 없음 | API 호출을 위한 전달자 토큰입니다. |
| `MEMORY_CORE_WORKSPACE_KEY` | 아니요 | `personal` | 설정되지 않은 경우 기본 작업공간입니다. |
| `MCP_ADAPTER_LOG_LEVEL` | 아니요 | 어댑터 기본값 | 로그는 `stderr`으로만 이동됩니다. |

빠른 실패 검증:
- mcp-adapter는 시작 시 `MEMORY_CORE_URL`/`MEMORY_CORE_API_KEY`의 유효성을 검사합니다(Zod 기반).
- 잘못된 값은 나중에 도구 호출 중에 실패하는 대신 즉시 실패합니다.

### 원격 MCP 런타임(`claustrum-mcp`)

| 변수 | 필수 | 기본값 | 메모 |
|---|---|---|---|
| `CLAUSTRUM_BASE_URL` | 예(런타임 모드) | 없음 | 원격 REST 게이트웨이; 어댑터는 JSON-RPC를 `/v1/mcp`에 게시합니다. |
| `CLAUSTRUM_API_KEY` | 조건부 | 비어 있음 | 업스트림 게이트웨이용 Bearer API 키입니다. |
| `CLAUSTRUM_AUTH_TOKEN` | 조건부 | 비어 있음 | API 키가 사용되지 않는 경우 대체 전달자 토큰입니다. |
| `CLAUSTRUM_HOME` | 아니요 | `~/.claustrum` | 런타임 홈(버전, 로그, 상태, 잠금). |
| `CLAUSTRUM_LOG_LEVEL` | 아니요 | `error` | 파일+stderr 로그 임계값. |
| `CLAUSTRUM_AUTO_UPDATE` | 아니요 | `true` | GitHub 릴리스 자동 업데이트 확인을 활성화합니다. |
| `CLAUSTRUM_UPDATE_CHANNEL` | 아니요 | `stable` | 채널(`stable`/`beta`)을 업데이트하세요. |
| `CLAUSTRUM_UPDATE_REPO` | 아니요 | `stephen-kim/claustrum` | 업데이트 소스 저장소가 허용되었습니다. |
| `CLAUSTRUM_REQUEST_TIMEOUT_MS` | 아니요 | `15000` | 시도당 업스트림 요청 시간 초과입니다. |
| `CLAUSTRUM_REQUEST_RETRY_COUNT` | 아니요 | `1` | 일시적인 네트워크 오류에 대한 재시도 횟수입니다. |

## 관리 UI

| 변수 | 필수 | 기본값 | 메모 |
|---|---|---|---|
| `NEXT_PUBLIC_MEMORY_CORE_URL` | 예 | 없음 | 브라우저에서 연결할 수 있는 메모리 코어 URL입니다. |
| `ADMIN_UI_PORT` | 아니요(작성) | `3000` | Compose의 호스트 포트 매핑. |

## Docker Compose 변수

| 변수 | 필수 | 기본값 | 메모 |
|---|---|---|---|
| `POSTGRES_DB` | Localdb 프로필만 | `claustrum` | Postgres 부트스트랩 DB 이름입니다. |
| `POSTGRES_USER` | Localdb 프로필만 | `claustrum` | Postgres 부트스트랩 사용자입니다. |
| `POSTGRES_PASSWORD` | Localdb 프로필만 | `claustrum` | Postgres 부트스트랩 비밀번호. |
| `COMPOSE_PROFILES` | 선택사항 | 비어 있음 | `--profile localdb` 없이 로컬 postgres 프로필을 자동 활성화하려면 `localdb`을 설정합니다. |
| `MEMORY_CORE_IMAGE` | 선택사항 | `ghcr.io/stephen-kim/claustrum-memory-core:latest` | 배포 작성을 위한 이미지 재정의. |
| `MCP_ADAPTER_IMAGE` | 선택사항 | `ghcr.io/stephen-kim/claustrum-mcp-adapter:latest` | 배포 작성을 위한 이미지 재정의. |
| `ADMIN_UI_IMAGE` | 선택사항 | `ghcr.io/stephen-kim/claustrum-admin-ui:latest` | 배포 작성을 위한 이미지 재정의. |

## GitHub Actions 비밀(선택적 작업 흐름)

이는 로컬 `.env` 키가 아닌 GitHub 저장소/조직 **비밀**입니다.

| 비밀 | 사용하는 사람 | 메모 |
|---|---|---|
| `MEMORY_CORE_URL` | `claustrum-ci-events`, `notion-merge-sync` | Actions Runner에서 연결할 수 있는 메모리 코어 엔드포인트입니다. |
| `MEMORY_CORE_API_KEY` | `claustrum-ci-events`, `notion-merge-sync` | 무기명 토큰. |
| `MEMORY_CORE_WORKSPACE_KEY` | `claustrum-ci-events` | CI 이벤트 수집을 위한 작업 공간입니다. |
| `MEMORY_CORE_PROJECT_KEY` | `claustrum-ci-events` | 선택적 고정 프로젝트 대상. |
| `NOTION_WORKSPACE_KEY` | `notion-merge-sync` | Notion 쓰기 작업을 위한 작업 공간입니다. |
| `NOTION_PAGE_ID` | `notion-merge-sync` | 선택적 대상 페이지. |
| `NOTION_PARENT_PAGE_ID` | `notion-merge-sync` | 선택적 상위 페이지 대상. |

## 메모

- `.env.example`을 최소화하세요.
- `.env`에는 활성 값만 입력하세요.
- 의도적으로 ENV 모드를 강제하지 않는 한 관리 UI에서 DB에 저장된 통합 설정을 선호합니다.

최종 업데이트 날짜: 2026-02-18