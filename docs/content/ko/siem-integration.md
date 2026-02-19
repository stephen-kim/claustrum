# SIEM 통합

Claustrum은 **감사 싱크**를 통해 append-only 감사 이벤트를 외부 SIEM 엔드포인트로 푸시할 수 있습니다.

## 감사 싱크 모델

- `audit_sinks`: 대상 + 필터 + 재시도 정책입니다.
- `audit_delivery_queue`: `(sink_id, audit_log_id)`당 내구성 있는 배달 대기열입니다.

## 배송 흐름

1. `audit_logs` 행이 삽입됩니다.
2. `event_filter`에 의해 일치하는 싱크가 선택됩니다.
3. 행은 `audit_delivery_queue`의 대기열에 추가됩니다.
4. 백그라운드 작업자는 HMAC 서명과 함께 HTTP POST를 보냅니다.
5. 성공: `delivered`, 실패: 백오프 재시도, `failed`.

## 서명

각 웹훅 요청에는 다음이 포함됩니다.

- `X-Claustrum-Event`
- `X-Claustrum-Workspace`
- `X-Claustrum-Delivery`
- `X-Claustrum-Signature: sha256=<hex>`

서명 입력:

```text
HMAC_SHA256(secret, raw_json_body)
```
## 재시도/백오프

싱크당 `retry_policy`:

```json
{
  "max_attempts": 5,
  "backoff_sec": [1, 5, 30, 120, 600]
}
```
## 관리 UI

`Workspace → Integrations → SIEM`

- 싱크 만들기
- 테스트 납품
- 필터링된 배송상태 보기(`queued/sending/delivered/failed`)
