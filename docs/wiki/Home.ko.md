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

- [설치 가이드](Installation.ko)
- [운영 가이드](Operations.ko)
- [보안 및 MCP I/O](Security-and-MCP-IO.ko)
- [Notion 연동](Notion-Integration.ko)
- [Atlassian 연동](Atlassian-Integration.ko)
- [Linear 연동](Linear-Integration.ko)
- [Slack 감사 연동](Slack-Audit.ko)
- [릴리즈 노트](Release-Notes.ko)
- [Installation (English)](Installation)


## API 요약

- `GET /healthz`
- `POST /v1/resolve-project`
- `GET/POST /v1/workspaces`
- `GET/POST /v1/projects`
- `GET/POST /v1/memories`
- `GET/PUT /v1/workspace-settings`
- `GET/PUT /v1/integrations`
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
