# 감사 보존

최종 업데이트: 2026년 2월 17일

## 작업공간 설정

보존은 작업 영역별로 구성됩니다.

- `retention_policy_enabled` (기본값: `false`)
- `audit_retention_days` (기본값: `365`)
- `raw_retention_days` (기본값: `90`)
- `retention_mode` (`archive` | `hard_delete`, 기본값: `archive`)

## 데이터 처리

### raw_events

- `raw_retention_days`보다 오래된 행은 삭제됩니다.

### 감사_로그

두 가지 모드:

- `archive`(권장):
  - 이전 행을 `audit_logs_archive`에 복사합니다.
  - `audit_logs`에서 복사된 행을 제거합니다.
- `hard_delete`:
  - `audit_logs`에서 직접 이전 행을 제거합니다.

## 작업 실행

- 메모리 코어는 예약된 보존 청소(일일 케이던스)를 실행합니다.
- `retention_policy_enabled=true`이 포함된 작업공간만 처리됩니다.
- 각 실행은 `audit.retention.run`을 방출합니다.

`audit.retention.run` 매개변수에는 다음이 포함됩니다.

- `retention_mode`
- `audit_retention_days`
- `raw_retention_days`
- `archived_count`
- `deleted_count`
- `raw_deleted_count`

## 운영 지침

- `archive` 모드로 시작하세요.
- 기업 환경에서 감사를 위해 최소 180~365일을 유지하세요.
- 법적/규정 준수 제약으로 인해 엄격한 데이터 최소화가 필요한 경우에만 `hard_delete`을 사용하세요.