# 릴리즈 노트


## 2026-02-16


### 모노레포 확장

- pnpm workspace 구조 도입:
  - `apps/memory-core`
  - `apps/mcp-adapter`
  - `apps/admin-ui`
  - `packages/shared`
- 팀 확장형 Memory Core 백엔드(Prisma/Postgres, REST 중심) 추가
- MCP stdio thin adapter 추가 (`set_workspace`, `set_project`, `remember`, `recall`, `list_projects`, `search_raw`)
- idempotent seed 플로우 추가
- Admin UI(워크스페이스/유저/프로젝트/멤버/검색/상세) 추가
- Docker compose 기반 운영 구성 추가
- resolver 모델/API 추가
  - `workspace_settings`, `project_mappings`
  - `/v1/resolve-project`, `/v1/workspace-settings`, `/v1/project-mappings`
- raw import/snippet search/audit 모델/API 추가
  - `imports`, `raw_sessions`, `raw_messages`, `staged_memories`, `audit_logs`
  - `/v1/imports` + parse/extract/commit
  - `/v1/raw/search`, `/v1/raw/messages/:id`
  - audit 이벤트 `raw.search`, `raw.view`


### 핵심 변경점

- 런타임 저장소를 SQLite에서 PostgreSQL로 전환
- `pnpm db:migrate` 기반 마이그레이션 체계 정리
- 프로젝트 자동 선택(resolver) + key 기반 스코프 모델 강화
- 기본 recall은 memories-only 유지
- raw 검색은 snippet-only + 길이 제한 + 감사 로그 적용
- `audit_reasoner` 연동 추가 (비동기 AI 감사 사유 생성)
  - Provider: OpenAI 또는 Gemini
  - 우선순위: `ENV > Admin UI` 워크스페이스 설정


### MCP 호환성

- stdout은 JSON-RPC만 출력
- 운영 로그/진단은 stderr로만 출력
