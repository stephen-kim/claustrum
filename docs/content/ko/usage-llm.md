# LLM 사용량 추적

Claustrum은 LLM 호출 비용을 운영 관점에서 추적할 수 있도록, 호출 단위 사용량 이벤트를 기록합니다.

## 무엇을 기록하나요?

- `workspace_id`
- `project_id` (있을 때)
- `actor_user_id` 또는 `system_actor`
- `purpose` (`decision_extract`, `summarize`, `routing`, `eval_judge` 등)
- `provider`, `model`
- `input_tokens`, `output_tokens` (제공자가 반환하는 경우)
- `estimated_cost_cents` (`llm_pricing` 기준)
- `correlation_id`
- `created_at`

## 무엇은 기록하지 않나요?

- 프롬프트 원문
- 응답 원문
- Authorization 헤더, API key

## 비용 계산 기준

단가는 `llm_pricing` 테이블에서 관리합니다.

```text
estimated_cost_cents =
  (input_tokens / 1000) * input_token_price_per_1k_cents +
  (output_tokens / 1000) * output_token_price_per_1k_cents
```text

모델 단가가 등록되지 않은 경우 `estimated_cost_cents`는 `0` 또는 `null`로 내려올 수 있습니다.

## Usage API

`GET /v1/usage/llm`

쿼리 파라미터:

- `workspace_key` (필수)
- `from` (선택, ISO datetime)
- `to` (선택, ISO datetime)
- `group_by` = `day | purpose | model` (기본: `day`)

응답은 그룹별 집계(`items`)와 전체 합계(`totals`)를 함께 반환합니다.

## Admin UI

Admin Console의 **LLM Usage** 패널에서 아래를 바로 확인할 수 있습니다.

- 일자/목적/모델 기준 그룹 조회
- 기간 필터
- 총 입력/출력 토큰
- 추정 비용 합계
- 그룹별 상세 테이블
