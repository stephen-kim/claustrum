# Slack 감사 통합

## 목표

팀이 다음을 확인할 수 있도록 감사 이벤트를 Slack에 보냅니다.
- 설정을 변경한 사람
- 무엇이 바뀌었나
- 왜 바뀌었나

이는 아웃바운드 알림 통합입니다(MCP 읽기 도구 없음).

## 필요한 것

- Slack 수신 웹훅 URL
  - Slack 앱 생성 -> 수신 웹후크 -> 채널에 웹후크 추가
- 메모리 코어의 `workspace_key`(예: `personal`)

## 환경 변수(대체)

- `MEMORY_CORE_AUDIT_SLACK_WEBHOOK_URL`
- `MEMORY_CORE_AUDIT_SLACK_ACTION_PREFIXES`
- `MEMORY_CORE_AUDIT_SLACK_DEFAULT_CHANNEL`
- `MEMORY_CORE_AUDIT_SLACK_FORMAT`
- `MEMORY_CORE_AUDIT_SLACK_INCLUDE_TARGET_JSON`
- `MEMORY_CORE_AUDIT_SLACK_MASK_SECRETS`

## 단계별 설정

1. Slack 웹훅 생성
- Slack 앱에서 웹훅 URL을 생성합니다.
- 비밀로 해주세요.

2. 관리 UI에 구성 저장
- `admin-ui` 열기 -> 통합 -> Slack 감사.
- 저장:
  - `enabled=true`
  - `webhook_url`
  - `default_channel` (선택)
  - `action_prefixes`(선택적 필터 목록)
  - `format`(`detailed` 또는 `compact`)
  - `include_target_json` / `mask_secrets`
  - 선택사항 `routes` 및 `severity_rules`

3. API를 통해 구성 저장(선택 사항)

```bash
curl -X PUT "$MEMORY_CORE_URL/v1/integrations" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_key": "personal",
    "provider": "slack",
    "enabled": true,
    "reason": "enable slack audit notifications",
    "config": {
      "webhook_url": "https://hooks.slack.com/services/XXX/YYY/ZZZ",
      "default_channel": "#audit-core",
      "action_prefixes": ["integration.", "workspace_settings.", "git.", "ci."],
      "format": "detailed",
      "include_target_json": true,
      "mask_secrets": true,
      "routes": [
        { "action_prefix": "ci.", "channel": "#audit-devflow", "min_severity": "medium" },
        { "action_prefix": "integration.", "channel": "#audit-security", "min_severity": "high" }
      ],
      "severity_rules": [
        { "action_prefix": "integration.", "severity": "high" },
        { "action_prefix": "raw.", "severity": "low" }
      ]
    }
  }'
```
4. 트리거 및 확인
- 감사된 작업을 트리거합니다(예: `reason`을 사용하여 통합 설정 저장).
- 메시지 전달을 위해 Slack 채널을 확인하세요.
- API 측 로그를 확인하세요.

```bash
curl -G "$MEMORY_CORE_URL/v1/audit-logs" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  --data-urlencode "workspace_key=personal" \
  --data-urlencode "action_prefix=integration." \
  --data-urlencode "limit=20"
```
## 구성 참조

- `webhook_url`: 들어오는 웹훅 엔드포인트
- `default_channel`: 대체 Slack 채널
- `action_prefixes`: 접두사 중 하나로 작업이 시작될 때만 알림
- `format`: `detailed` 또는 `compact`
- `include_target_json`: 직렬화된 감사 대상을 포함합니다.
- `mask_secrets`: 페이로드 텍스트에서 토큰/비밀 수정
- `routes`: `[{ action_prefix, channel?, min_severity? }]`
- `severity_rules`: `[{ action_prefix, severity }]`

심각도 값:
- `low`
- `medium`
- `high`
- `critical`

## 환경과 관리 UI 우선순위

- 기본값: 관리 UI의 작업공간 구성이 환경 대체를 우선합니다.
- 예외: `audit_reasoner`은 `ENV > Admin UI` 우선순위를 사용합니다.
  - 환경 키: `MEMORY_CORE_AUDIT_REASONER_*`, `OPENAI_API_KEY`, `GEMINI_API_KEY`
  - 관리 UI 대체: 통합 -> 감사 추론기
- 잠금 옵션:
  - `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=slack`
  - 잠겨 있으면 관리 UI 업데이트가 차단되고 환경 전용이 적용됩니다.

## 문제 해결

- Slack 메시지 없음
  - 웹훅 URL이 유효하고 `enabled=true`인지 확인하세요.
  - `action_prefixes`이 설정된 경우 작업이 접두사와 일치하는지 확인합니다.
  - `routes.min_severity`이 설정된 경우 심각도 임계값이 일치하는지 확인합니다.
- `Integration provider "slack" is locked...`
  - `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS`에서 `slack`을 제거하거나 환경을 통해서만 관리하세요.