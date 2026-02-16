# Linear 연동

## 목적

MCP 워크플로에서 Linear를 외부 이슈 컨텍스트 소스로 사용합니다.
- 관련 이슈 검색
- 이슈 상세를 짧게 읽어 컨텍스트 확보
- 기본 recall은 memory-first 유지

## 서버 설정

`memory-core` 환경변수:

- `MEMORY_CORE_LINEAR_API_KEY` (필수)
- `MEMORY_CORE_LINEAR_API_URL` (선택, 기본값: `https://api.linear.app/graphql`)

`MEMORY_CORE_LINEAR_API_KEY`가 없으면 Linear 엔드포인트는 명확한 오류를 반환합니다.

서버 env가 비어 있어도 Admin UI의 워크스페이스별 Integration 설정(`/v1/integrations`)으로 저장/사용할 수 있습니다.

## API 엔드포인트

- `GET /v1/linear/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/linear/read?workspace_key=<ws>&issue_key=<ENG-123>&max_chars=4000`

## MCP 도구

`mcp-adapter` 제공:
- `linear_search({ q, limit? })`
- `linear_read({ issue_key, max_chars? })`

## 권한 및 감사 로그

- Linear 검색/열람은 workspace member 권한 필요
- 모든 호출은 `audit_logs`에 기록:
  - `linear.search`
  - `linear.read`
