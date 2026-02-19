# 활성 작업 부실 및 자동 종료

활성 작업은 최근 프로젝트 신호에서 추론되고 주기적으로 다시 계산됩니다.

## 주요 필드

`active_work`에는 다음이 포함됩니다.

- `stale` / `stale_reason`
- `last_evidence_at`
- `status` (`inferred` | `confirmed` | `closed`)
- `closed_at`

## 작업공간 정책

작업공간 설정에서 구성:

- `active_work_stale_days`(기본값 `14`)
- `active_work_auto_close_enabled`(기본값 `false`)
- `active_work_auto_close_days`(기본값 `45`)

## 규칙

- `last_evidence_at`이 `stale_days`보다 오래된 경우 항목이 오래된 것으로 표시됩니다.
- 자동 닫기가 활성화되어 있고 항목이 `auto_close_days` 이후 오래된 상태로 유지되면 추론된 항목이 닫힙니다.
- 기본적으로 확인된 항목은 자동 종료 상태로 유지됩니다.

## 트리거 경로

- 매뉴얼 : `POST /v1/projects/:key/recompute-active-work`
- 예약됨: 야간 재계산 작업

최종 업데이트 날짜: 2026-02-18