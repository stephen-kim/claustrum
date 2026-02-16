# 운영 가이드

## 데이터/리콜 모델

- 기본 recall은 `memories`만 조회
- raw 임포트 원문은 기본 recall과 분리
- raw 조회는 옵션 도구에서 snippet-only로 제공

## Raw 임포트 파이프라인

1. `POST /v1/imports` (multipart 업로드)
2. `POST /v1/imports/:id/parse`
3. `POST /v1/imports/:id/extract`
4. `POST /v1/imports/:id/commit`

데이터 흐름:
- `imports` -> `raw_sessions/raw_messages` -> `staged_memories` -> `memories`

파서 지원:
- `source=codex`: Codex JSONL 전용 파서
- `source=claude`: Claude JSON export 전용 파서 (역할 정규화: `human -> user`, `assistant -> assistant`)
- 그 외: generic 텍스트 청크 파서 fallback

## 프로젝트 자동 선택

기본 우선순위:
1. `github_remote`
2. `repo_root_slug`
3. `manual`

워크스페이스 설정:
- `resolution_order`
- `auto_create_project`
- key prefix
- `project_mappings`

## Admin UI 운영 체크리스트

- 워크스페이스/프로젝트/멤버 관리
- 자동 선택 설정/매핑 관리
- 임포트 실행 후 staged memory 커밋
- raw snippet 검색
- audit 로그(`raw.search`, `raw.view`) 검토

## 자주 쓰는 명령어

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm test:workspace
```

## 백업/복구 기본 권장

- Postgres 정기 백업
- migration SQL 버전관리 유지
- 복구 검증 시 순서:
  - migrate
  - seed (idempotent)
  - smoke test
