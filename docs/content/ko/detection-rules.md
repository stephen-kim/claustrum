# 탐지 규칙

Claustrum에는 의심스러운 액세스 패턴에 대한 최소 임계값 기반 탐지 엔진이 포함되어 있습니다.

## 데이터 모델

- `detection_rules`: 규칙 정의
- `detections`: 트리거된 결과(`open|ack|closed`)

## 규칙 스키마(임계값)

```json
{
  "name": "Raw search burst",
  "enabled": true,
  "severity": "high",
  "condition": {
    "type": "threshold",
    "action_key": "raw.search",
    "window_sec": 300,
    "count_gte": 20,
    "group_by": "actor_user_id"
  },
  "notify": {
    "via": "security_stream"
  }
}
```
## 엔진 동작

- 작업자는 매분마다 실행됩니다.
- 최근 `audit_logs`에 대해 활성화된 규칙을 평가합니다.
- 중복을 피하기 위해 `(rule, group, time-bucket)`당 하나의 탐지를 생성합니다.
- 상관관계 ID를 사용하여 `security.detection.triggered` 감사 이벤트를 내보냅니다.
- 그런 다음 보안 스트림이 SIEM 싱크로 전달됩니다.

## 시드된 기본 규칙

- 원시 검색 버스트: 배우당 5분 안에 `raw.search >= 20`.
- 권한 이탈: 10분 후 `access.project_member.role_changed >= 30`.
- API 키 변동: `api_key.reset >= 5` 10분 후.

## 작업

관리 UI:

- 규칙 생성/업데이트/삭제
- 탐지 보기
- 승인/종료 감지

권장 출시 계획:

1. 심각도가 높은 규칙으로만 시작합니다.
2. 일주일간 관찰해보세요.
3. 잘못된 긍정을 줄이기 위해 임계값을 조정합니다.
