# Notion 연동

## 목적

Notion을 외부 컨텍스트 소스로 활용합니다.
- 코딩 세션 중 문서 검색/열람
- (선택) merge 시점 문서 자동 반영

## 서버 설정

`memory-core` 환경변수:

- `MEMORY_CORE_NOTION_TOKEN` (read/search 필수)
- `MEMORY_CORE_NOTION_DEFAULT_PARENT_PAGE_ID` (create 기본 부모 페이지, 선택)
- `MEMORY_CORE_NOTION_WRITE_ENABLED=true` (write API 활성화 시 필수)

서버 env가 비어 있어도 Admin UI의 워크스페이스별 Integration 설정(`/v1/integrations`)으로 저장/사용할 수 있습니다.

워크스페이스 저장 키:
- `token`
- `default_parent_page_id`
- `write_enabled` (boolean)

## API 엔드포인트

read/search:
- `GET /v1/notion/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/notion/read?workspace_key=<ws>&page_id=<id-or-url>&max_chars=4000`

write (admin 전용):
- `POST /v1/notion/write`

예시:

```json
{
  "workspace_key": "personal",
  "title": "Merge Summary",
  "content": "변경 내용 및 의사결정 요약",
  "page_id": "기존 페이지 업데이트 시 선택",
  "parent_page_id": "신규 생성 시 선택"
}
```

## MCP 도구

`mcp-adapter` 제공:
- `notion_search({ q, limit? })`
- `notion_read({ page_id, max_chars? })`
- `notion_context({ q?, page_id?, limit?, max_chars? })`

권장 사용 순서:
1. `notion_context({ q: "<프로젝트/토픽>" })` 로 빠른 컨텍스트 부트스트랩
2. 필요 시 `notion_read({ page_id })` 로 특정 문서 정밀 확인

## 권한 및 감사 로그

- Notion read/search: workspace member 권한
- Notion write: workspace admin + `MEMORY_CORE_NOTION_WRITE_ENABLED=true`
- 감사 이벤트:
  - `notion.search`
  - `notion.read`
  - `notion.write`

## Merge 기반 Write (권장)

로컬 git 훅보다 CI(GitHub Actions) 기반 merge 트리거 write를 권장합니다.

이유:
- 실행 환경/시크릿 일관성
- 개발자 로컬 환경 차이 최소화
- 훅 실패로 개발 흐름이 막히는 위험 감소

권장 플로우:
1. `main` 브랜치 push(merge) 트리거
2. 커밋/PR 요약 생성
3. `/v1/notion/write` 호출
4. 워크플로 로그에 결과 기록

참고 워크플로:
- `/Users/stephen/dev/context-sync/.github/workflows/notion-merge-sync.yml`
