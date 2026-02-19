# Atlassian 통합(Jira + Confluence)

## 목표

MCP 워크플로에서 Jira 및 Confluence를 외부 컨텍스트 소스로 사용합니다.
- Jira: 이슈 컨텍스트 검색/읽기
- Confluence: 문서 컨텍스트 검색/읽기
- 둘 다 읽기 중심이며 감사됩니다.

## 필요한 것

- Atlassian Cloud 사이트 URL(예: `https://your-org.atlassian.net`)
- Atlassian 계정 이메일
- Atlassian API 토큰
  - Atlassian 계정 보안 설정에서 생성
- 메모리 코어의 `workspace_key`(예: `personal`)

## 환경 변수(대체)

- 지라
  - `MEMORY_CORE_JIRA_BASE_URL`
  - `MEMORY_CORE_JIRA_EMAIL`
  - `MEMORY_CORE_JIRA_API_TOKEN`
- 컨플루언스
  - `MEMORY_CORE_CONFLUENCE_BASE_URL`
  - `MEMORY_CORE_CONFLUENCE_EMAIL`
  - `MEMORY_CORE_CONFLUENCE_API_TOKEN`

## 단계별 설정

1. Atlassian API 토큰 생성
- 하나의 토큰을 생성하고 Jira + Confluence에 재사용하세요.
- 비밀관리자에 보관하세요.

2. 관리 UI에 구성 저장
- `admin-ui` 열기 -> 통합.
- Jira 저장:
  - `enabled=true`
  - `base_url`
  - `email`
  - `api_token`
- 컨플루언스 저장:
  - `enabled=true`
  - `base_url`(`https://your-org.atlassian.net` 또는 `https://your-org.atlassian.net/wiki`)
  - `email`
  - `api_token`
- 선택사항:
  - `write_on_commit`
  - `write_on_merge`
  - 현재 공급자 측 쓰기가 아닌 감사/후크 라우팅을 구동합니다.

3. API를 통해 구성 저장(선택 사항)

```bash
curl -X PUT "$MEMORY_CORE_URL/v1/integrations" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_key": "personal",
    "provider": "jira",
    "enabled": true,
    "reason": "enable jira context for team",
    "config": {
      "base_url": "https://your-org.atlassian.net",
      "email": "you@company.com",
      "api_token": "atlassian-token"
    }
  }'
```

```bash
curl -X PUT "$MEMORY_CORE_URL/v1/integrations" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_key": "personal",
    "provider": "confluence",
    "enabled": true,
    "reason": "enable confluence context for docs",
    "config": {
      "base_url": "https://your-org.atlassian.net/wiki",
      "email": "you@company.com",
      "api_token": "atlassian-token"
    }
  }'
```
4. API로 검증

```bash
curl -G "$MEMORY_CORE_URL/v1/jira/search" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  --data-urlencode "workspace_key=personal" \
  --data-urlencode "q=deployment incident" \
  --data-urlencode "limit=5"
```

```bash
curl -G "$MEMORY_CORE_URL/v1/confluence/search" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  --data-urlencode "workspace_key=personal" \
  --data-urlencode "q=runbook" \
  --data-urlencode "limit=5"
```
5. MCP 도구에서 유효성을 검사합니다.
- `jira_search({ q, limit? })`
- `jira_read({ issue_key, max_chars? })`
- `confluence_search({ q, limit? })`
- `confluence_read({ page_id, max_chars? })`

## API 엔드포인트

지라:
- `GET /v1/jira/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/jira/read?workspace_key=<ws>&issue_key=<ABC-123>&max_chars=4000`

합류:
- `GET /v1/confluence/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/confluence/read?workspace_key=<ws>&page_id=<id-or-url>&max_chars=4000`

## 권한 및 감사

- 읽기/검색에는 워크스페이스 멤버 액세스가 필요합니다.
- 모든 통화는 `audit_logs`에 기록됩니다.
  - `jira.search`
  - `jira.read`
  - `confluence.search`
  - `confluence.read`

## 환경과 관리 UI 우선순위

- 기본값: 관리 UI의 작업공간 구성이 환경 대체를 우선합니다.
- 잠금 옵션:
  - `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=jira,confluence`
  - 잠겨 있으면 관리 UI 업데이트가 차단되고 환경 전용이 적용됩니다.

## 문제 해결

- `Invalid API key`
  - `Authorization: Bearer <key>`을 확인하세요.
- `Integration not configured` 스타일 오류
  - `base_url`, `email`, `api_token`이 작업공간에 저장되었는지 확인하세요.
- 검색은 작동하지만 읽기는 실패합니다.
  - 이슈 키/페이지 ID가 존재하고 Atlassian에서 권한이 부여되었는지 확인하세요.