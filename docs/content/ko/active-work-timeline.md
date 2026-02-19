# 활성 작업 타임라인

모든 의미 있는 활성 작업 상태 전환은 변경할 수 없는 타임라인 이벤트를 생성합니다.

## 이벤트 매장

테이블: `active_work_events`

이벤트 유형:

- `created`
- `updated`
- `stale_marked`
- `stale_cleared`
- `confirmed`
- `closed`
- `reopened`

각 이벤트에는 다음이 포함될 수 있습니다.

- 점수/증거 세부정보
- 이전 상태와 다음 상태
- 선택사항 `correlation_id`

## API

- `GET /v1/projects/:key/active-work`
- `GET /v1/projects/:key/active-work/events`
- `POST /v1/active-work/:id/confirm`
- `POST /v1/active-work/:id/close`
- `POST /v1/active-work/:id/reopen`

## 관리 UI

컨텍스트 디버그는 다음을 보여줍니다:

- 현재 활성 작업 목록
- 부실/폐쇄 상태
- 세부정보 JSON이 포함된 이벤트 타임라인
- 수동 제어(관리자+)

수동 재정의는 감사됩니다(`active_work.manual_confirm`, `active_work.manual_close`, `active_work.manual_reopen`).

최종 업데이트 날짜: 2026-02-18