# Claustrum 위키 홈


## 개요

Claustrum은 MCP 클라이언트를 위한 팀 확장형 Memory Core 시스템입니다.

구성:
- `memory-core`: REST API + Postgres 데이터 레이어
- `mcp-adapter`: memory-core를 호출하는 stdio MCP 어댑터
- `admin-ui`: 운영 대시보드

핵심 원칙:
- MCP 안전성: `stdout`은 JSON-RPC만, 로그는 `stderr`
- 기본 recall: 정제된 `memories`만 조회
- raw 검색: snippet-only + audit 로그


## 다음 문서

- [최근 변경 사항](recent-updates.ko)
- [설치 가이드](Installation.ko)
- [환경변수 전체 레퍼런스](Environment-Variables.ko)
- [의존성 관리 (pnpm)](dependency-management)
- [CI](ci)
- [Release Gate](release-gate)
- [운영 가이드](Operations.ko)
- [보안 및 MCP I/O](Security-and-MCP-IO.ko)
- [OIDC SSO](OIDC-SSO.ko)
- [Group Mapping](Group-Mapping.ko)
- [Notion 연동](Notion-Integration.ko)
- [Atlassian 연동](Atlassian-Integration.ko)
- [Linear 연동](Linear-Integration.ko)
- [GitHub 권한 동기화](github-permission-sync)
- [Slack 변경 이력 알림 연동](Slack-Audit.ko)
- [Outbound 로케일/프롬프트 정책](Outbound-Locales.ko)
- [Persona (사용자별 컨텍스트 모드)](persona)
- [Active Work Stale/Auto-close](active-work-stale)
- [Active Work Timeline](active-work-timeline)
- [Context Debug](context-debug)
- [Context Bundle Eval](context-bundle-eval)
- [릴리즈 노트](Release-Notes.ko)
- [Installation (English)](Installation)


## 최근 중요 변경

- CI/로컬 테스트: clean 환경에서 `ERR_MODULE_NOT_FOUND`가 나지 않도록 `memory-core` 테스트 전에 `@claustrum/shared` 선빌드를 강제했습니다.
- PR 품질 검증: Context Bundle Eval이 PR마다 실행되며, 점수/실패 Top/토큰 예산 경고를 sticky comment로 갱신합니다.
- 릴리즈 안정성: release-gate로 bootstrap/login gating, 격리, RBAC, webhook, secret 노출 검증을 한 번에 수행합니다.


## API 요약

- `GET /healthz`
- `POST /v1/resolve-project`
- `GET/POST /v1/workspaces`
- `GET/POST /v1/projects`
- `GET/POST /v1/memories`
- `GET/PUT /v1/workspace-settings`
- `GET /v1/auth/oidc/:workspace_key/start`
- `GET /v1/auth/oidc/:workspace_key/callback`
- `GET/PUT /v1/workspaces/:key/sso-settings`
- `GET/POST/PATCH /v1/oidc/providers`
- `GET/POST/PATCH/DELETE /v1/oidc/group-mappings`
- `GET/PUT /v1/integrations`
- `GET/POST/DELETE /v1/workspaces/:key/github/user-links`
- `POST /v1/workspaces/:key/github/sync-permissions`
- `GET /v1/workspaces/:key/github/permission-status`
- `GET/POST/PATCH /v1/project-mappings`
- `GET/POST /v1/users`
- `GET/POST /v1/project-members`
- `GET/POST /v1/imports`
- `POST /v1/imports/:id/parse`
- `POST /v1/imports/:id/extract`
- `GET /v1/imports/:id/staged`
- `POST /v1/imports/:id/commit`
- `GET /v1/raw/search`
- `GET /v1/raw/messages/:id`
- `GET /v1/audit-logs`
- `POST /v1/raw-events`
- `GET /v1/raw-events`
- `POST /v1/git-events`
- `POST /v1/ci-events`
- `GET/PUT /v1/workspaces/:key/outbound-settings`
- `GET/PUT /v1/outbound-policies/:integration_type`
- `POST /v1/outbound/render`
- `GET /v1/jira/search`
- `GET /v1/jira/read`
- `GET /v1/confluence/search`
- `GET /v1/confluence/read`
- `GET /v1/linear/search`
- `GET /v1/linear/read`


## Decision 자동 추출

Raw git 이벤트를 자동으로 `decision` 메모리로 추출할 수 있습니다.

- 입력: `raw_events` (`post_commit`, `post_merge`, 옵션 `post_checkout`)
- 기본 출력:
  - `source=auto`
  - `status=draft`
  - `confidence` (rule 기반)
  - `evidence` (`raw_event_ids`, `commit_sha`, 변경 파일)

`auto_confirm`은 옵션이며 워크스페이스 정책으로 제어됩니다.


## Draft / Confirmed 흐름

`memories.status`:

- `draft`
- `confirmed`
- `rejected`

Admin UI에서 상태/소스/confidence 기준 필터링 후 draft decision을 confirmed/rejected로 전환할 수 있습니다.


## Hybrid 검색 (FTS + pgvector)

`GET /v1/memories`는 `mode=keyword|semantic|hybrid`를 지원합니다.

- `keyword`: PostgreSQL FTS (`content_tsv`, `ts_rank_cd`)
- `semantic`: pgvector 코사인 유사도 (`embedding`)
- `hybrid`(기본): 가중치 합산
  - `alpha` (vector 가중치)
  - `beta` (FTS 가중치)

기본값은 workspace settings에서 조정합니다:

- `search_default_mode`
- `search_hybrid_alpha`
- `search_hybrid_beta`
- `search_default_limit`
