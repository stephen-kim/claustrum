# 아웃바운드 로케일 및 프롬프트 조정

## 정책

- 관리 UI는 현재 영어로 제공됩니다.
- 데이터베이스 기록은 언어 중립적입니다(`action`, `target` params/metadata).
- 로케일 및 프롬프트 튜닝은 아웃바운드 통합(Slack/Jira/Confluence/Notion/Webhook/Email)에만 적용됩니다.

## 로케일 확인

아웃바운드 로케일 선택 순서:

1. 재정의 요청(`locale`)
2. 통합정책 `locale_default`
3. 작업공간 `default_outbound_locale`
4. 대체 `en`

지원되는 로캘 필터링은 작업 영역 및 통합 정책 수준 모두에 적용됩니다.

## API

- `GET /v1/workspaces/:key/outbound-settings`
- `PUT /v1/workspaces/:key/outbound-settings`
- `GET /v1/outbound-policies/:integration_type?workspace_key=...`
- `PUT /v1/outbound-policies/:integration_type`
- `POST /v1/outbound/render`
- `GET /v1/outbound/template-variables?workspace_key=...&integration_type=...`

## 템플릿 재정의

`template_overrides` 형식(액체):

```json
{
  "raw.search": {
    "en": "Searched raw logs for \"{{ q }}\" ({{ count }} results).",
    "ko": "원문 로그에서 \"{{ q }}\"를 검색했습니다. (결과 {{ count }}개)"
  }
}
```text
규칙:

- Liquid는 아웃바운드 메시지를 위한 고정 렌더링 엔진입니다.
- 템플릿 재정의가 기본 제공 템플릿보다 우선합니다.
- 누락된 로캘은 `en`으로 대체됩니다.
- 누락된 동작 키는 안전한 일반 문장으로 대체됩니다.

이제 관리 UI에 변수 카탈로그(공통 + 작업별)가 표시되므로 운영자는 런타임 매개변수를 추측하지 않고도 템플릿 형식을 지정할 수 있습니다.