# 감사 모델

최종 업데이트: 2026년 2월 17일

## 원칙

- 감사는 기본적으로 append-only입니다.
- Mutation(`UPDATE`/`DELETE`)을 DB 수준에서 차단합니다.
- 상관관계 ID는 하나의 작업에서 관련된 이벤트를 그룹화합니다.
- 내보내기는 관리자 전용이며 자체적으로 감사됩니다.

## 추가만 적용

Claustrum은 `audit_logs`에 대한 트리거를 사용하여 Postgres에서 append-only 동작을 시행합니다.

- 허용됨: `INSERT`
- 차단됨: `UPDATE`, `DELETE`
- 예외 경로: 보존 유지 트랜잭션 세트 `claustrum.audit_maintenance=on`

이렇게 하면 일반 앱 경로를 변경할 수 없게 유지하는 동시에 보존 작업을 제어할 수 있습니다.

## 이벤트 분류

액세스 관련 키:

- `access.workspace_member.added`
- `access.workspace_member.role_changed`
- `access.workspace_member.removed`
- `access.project_member.added`
- `access.project_member.role_changed`
- `access.project_member.removed`

작동 키:

- `audit.export`
- `audit.retention.run`

## 상관 ID

`audit_logs.correlation_id`은 배치 수준 추적에 사용됩니다.

일반적인 생산자:

- GitHub 웹훅 전달(`delivery_id`)
- GitHub 권한 동기화 작업 ID
- OIDC 동기화 트랜잭션 ID
- 일괄 역할 변경 작업 ID

## 내보내기

끝점:

- `GET /v1/audit/export`

지원:

- `format=csv|json`
- `workspace_key` 필수
- 선택사항 `project_key`, `source`, `action`, `from`, `to`

행동:

- 대규모 데이터세트의 출력을 스트리밍합니다.
- 작업공간 관리자가 필요합니다.
- `audit.export` 이벤트 작성

## 관리 UI

액세스 타임라인은 다음을 지원합니다.

- 소스/액션/프로젝트/사용자/날짜 필터
- 상관관계 기반 그룹화(`Batch change (X events)`)
- 확장 가능한 이벤트 세부정보(`params`, `evidence`, `correlation_id`)
- CSV/JSON 내보내기