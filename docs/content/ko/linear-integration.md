# 리니어 연동

## 목표

MCP 워크플로의 외부 문제 컨텍스트 소스로 Linear를 사용합니다.
- 관련 이슈 검색
- 짧은 맥락에 대한 문제 세부정보 읽기
- 기억 회상 기억 우선 유지

## 필요한 것

- 리니어 API 키
  - 리니어 설정에서 생성(개인 API 키)
- 선택적 사용자 정의 API URL(기본값: `https://api.linear.app/graphql`)
- 메모리 코어의 `workspace_key`(예: `personal`)

## 환경 변수(대체)

- `MEMORY_CORE_LINEAR_API_KEY`
- `MEMORY_CORE_LINEAR_API_URL`

## 단계별 설정

1. 리니어 API 키 생성
- 팀 안정성을 위해 전용 서비스 계정이나 관리자 계정을 사용하세요.
- 비밀 관리자에 저장하세요.

2. 관리 UI에 구성 저장
- `admin-ui` 열기 -> 통합 -> 리니어.
- 저장:
  - `enabled=true`
  - `api_key`
  - `api_url` (선택사항)
- 선택사항:
  - `write_on_commit`
  - `write_on_merge`
  - 현재 공급자 측 쓰기가 아닌 감사/후크 라우팅을 구동합니다.

3. API를 통해 구성 저장(선택 사항)

```shell
curl -X PUT "$MEMORY_CORE_URL/v1/integrations" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_key": "personal",
    "provider": "linear",
    "enabled": true,
    "reason": "enable linear issue context",
    "config": {
      "api_key": "lin_api_xxx",
      "api_url": "https://api.linear.app/graphql"
    }
  }'
```
4. API로 검증

```shell
curl -G "$MEMORY_CORE_URL/v1/linear/search" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  --data-urlencode "workspace_key=personal" \
  --data-urlencode "q=incident runbook" \
  --data-urlencode "limit=5"
```

```shell
curl -G "$MEMORY_CORE_URL/v1/linear/read" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  --data-urlencode "workspace_key=personal" \
  --data-urlencode "issue_key=ENG-123" \
  --data-urlencode "max_chars=2000"
```
5. MCP 도구에서 유효성을 검사합니다.
- `linear_search({ q, limit? })`
- `linear_read({ issue_key, max_chars? })`

## API 엔드포인트

- `GET /v1/linear/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/linear/read?workspace_key=<ws>&issue_key=<ENG-123>&max_chars=4000`

## 권한 및 감사

- 리니어 읽기/검색에는 작업 공간 구성원 액세스가 필요합니다.
- 모든 통화는 `audit_logs`에 기록됩니다.
  - `linear.search`
  - `linear.read`

## 환경과 관리 UI 우선순위

- 기본값: 관리 UI의 작업공간 구성이 환경 대체를 우선합니다.
- 잠금 옵션:
  - `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=linear`
  - 잠겨 있으면 관리 UI 업데이트가 차단되고 환경 전용이 적용됩니다.

## 문제 해결

- `Integration not configured` 스타일 오류
  - 작업공간에 `api_key`이 저장되고 `enabled=true`이 있는지 확인하세요.
- 검색은 작동하지만 읽기는 실패합니다.
  - 이슈 키가 존재하는지, API 키가 팀/프로젝트에 접근할 수 있는지 확인하세요.
