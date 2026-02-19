# 노션 연동

## 목표

AI 워크플로의 외부 컨텍스트로 Notion을 사용합니다.
- 코딩 세션 중 문서 읽기/검색
- 병합 시 선택적 쓰기 저장(로컬 git 후크보다 권장됨)

## 필요한 것

- 노션 연동 토큰
  - Notion 개발자에서 내부 통합 생성
- 해당 통합과 공유되는 대상 페이지/데이터베이스
- 메모리 코어의 `workspace_key`(예: `personal`)

## 환경 변수(대체)

- `MEMORY_CORE_NOTION_TOKEN`
- `MEMORY_CORE_NOTION_DEFAULT_PARENT_PAGE_ID`
- `MEMORY_CORE_NOTION_WRITE_ENABLED`

## 단계별 설정

1. Notion 연동 생성 및 승인
- 내부 통합 생성 및 토큰 복사(`secret_...`)
- 해당 통합을 통해 필요한 페이지/데이터베이스를 공유합니다.

2. 관리 UI에 구성 저장
- `admin-ui` 열기 -> 통합 -> Notion.
- 저장:
  - `enabled=true`
  - `token`
  - `default_parent_page_id` (선택)
  - `write_enabled`(쓰기 API 활성화)
  - 선택적 후크 플래그: `write_on_commit`, `write_on_merge`

3. API를 통해 구성 저장(선택 사항)

```shell
curl -X PUT "$MEMORY_CORE_URL/v1/integrations" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_key": "personal",
    "provider": "notion",
    "enabled": true,
    "reason": "enable notion context and merge write-back",
    "config": {
      "token": "secret_xxx",
      "default_parent_page_id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "write_enabled": true,
      "write_on_merge": true
    }
  }'
```markdown
4. API로 검증

```shell
curl -G "$MEMORY_CORE_URL/v1/notion/search" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  --data-urlencode "workspace_key=personal" \
  --data-urlencode "q=architecture" \
  --data-urlencode "limit=5"
```

```shell
curl -G "$MEMORY_CORE_URL/v1/notion/read" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  --data-urlencode "workspace_key=personal" \
  --data-urlencode "page_id=<notion-page-id-or-url>" \
  --data-urlencode "max_chars=2000"
```markdown
5. MCP 도구에서 유효성을 검사합니다.
- `notion_search({ q, limit? })`
- `notion_read({ page_id, max_chars? })`
- `notion_context({ q?, page_id?, limit?, max_chars? })`

## 구성 키

- `token`
- `default_parent_page_id`
- `write_enabled`
- `write_on_commit`
- `write_on_merge`

## API 엔드포인트

읽기/검색:
- `GET /v1/notion/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/notion/read?workspace_key=<ws>&page_id=<id-or-url>&max_chars=4000`

쓰기(관리자 전용):
- `POST /v1/notion/write`

예:

```json
{
  "workspace_key": "personal",
  "title": "Merge Summary",
  "content": "What changed and why...",
  "page_id": "optional-existing-page-id",
  "parent_page_id": "optional-parent-page-id"
}
```
## 권한 및 감사

- 노션 읽기/검색: 워크스페이스 멤버 접근
- 노션 쓰기: 작업 공간 관리자 + `MEMORY_CORE_NOTION_WRITE_ENABLED=true`
- 감사 조치:
  - `notion.search`
  - `notion.read`
  - `notion.write`

## 병합 기반 쓰기(권장)

로컬 git 후크보다 CI(예: GitHub Actions)에서 병합으로 트리거되는 문서 동기화를 선호합니다.

이유:
- 일관된 런타임 + 비밀
- 로컬 환경 드리프트 방지
- 개발자 측 후크 실패가 없습니다.

제안된 흐름:
1. `push`에서 `main`까지 트리거합니다.
2. 커밋/PR 요약 작성
3. 관리자 API 키를 사용하여 `/v1/notion/write`으로 전화하세요.
4. 작업 흐름 로그에 결과 기록

참조 작업 흐름:
- `.github/workflows/notion-merge-sync.yml`

## 환경과 관리 UI 우선순위

- 기본값: 관리 UI의 작업공간 구성이 환경 대체를 우선합니다.
- 잠금 옵션:
  - `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=notion`
  - 잠겨 있으면 관리 UI 업데이트가 차단되고 환경 전용이 적용됩니다.

## 문제 해결

- 검색/읽기 반환 구성 오류
  - 토큰, 페이지 공유, `enabled=true`을 확인하세요.
- 쓰기 실패
  - 워크스페이스 관리자 권한과 `write_enabled=true`을 확인하세요.
- 병합 후크 쓰기가 실행되지 않습니다.
  - `write_on_merge=true` 및 후크/이벤트 전달 설정을 확인하세요.
