# Atlassian 연동 (Jira + Confluence)

## 목적

Jira와 Confluence를 MCP 워크플로의 외부 컨텍스트 소스로 사용합니다.
- Jira: 이슈 컨텍스트 검색/열람
- Confluence: 문서 컨텍스트 검색/열람
- 둘 다 read 중심 + audit 추적

## 서버 설정

`memory-core` 환경변수:

- `MEMORY_CORE_JIRA_BASE_URL` (예: `https://your-org.atlassian.net`)
- `MEMORY_CORE_JIRA_EMAIL`
- `MEMORY_CORE_JIRA_API_TOKEN`
- `MEMORY_CORE_CONFLUENCE_BASE_URL` (예: `https://your-org.atlassian.net` 또는 `.../wiki`)
- `MEMORY_CORE_CONFLUENCE_EMAIL`
- `MEMORY_CORE_CONFLUENCE_API_TOKEN`

설정이 없으면 관련 엔드포인트는 비활성 상태이며 명확한 오류를 반환합니다.

서버 env가 비어 있어도 Admin UI의 워크스페이스별 Integration 설정(`/v1/integrations`)으로 저장/사용할 수 있습니다.

## API 엔드포인트

Jira:
- `GET /v1/jira/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/jira/read?workspace_key=<ws>&issue_key=<ABC-123>&max_chars=4000`

Confluence:
- `GET /v1/confluence/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/confluence/read?workspace_key=<ws>&page_id=<id-or-url>&max_chars=4000`

## MCP 도구

`mcp-adapter` 제공:
- `jira_search({ q, limit? })`
- `jira_read({ issue_key, max_chars? })`
- `confluence_search({ q, limit? })`
- `confluence_read({ page_id, max_chars? })`

## 권한 및 감사 로그

- 검색/열람은 workspace member 권한 필요
- 모든 호출은 `audit_logs`에 기록:
  - `jira.search`
  - `jira.read`
  - `confluence.search`
  - `confluence.read`

## 권장 방식

- 기본 recall은 memory-first(`remember/recall`)로 유지
- Jira/Confluence는 외부 컨텍스트 조회 용도로 사용
