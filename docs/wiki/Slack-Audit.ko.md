# Slack 감사 연동


## 목적

감사 이벤트를 Slack으로 전송해서 팀이 다음을 즉시 확인할 수 있도록 합니다.
- 누가 변경했는지
- 무엇이 변경됐는지
- 왜 변경했는지

Slack은 알림 전송용(outbound) 연동이며 MCP read 도구는 제공하지 않습니다.


## 준비물

- Slack Incoming Webhook URL
  - Slack 앱 생성 -> Incoming Webhooks 활성화 -> 채널 webhook 생성
- memory-core `workspace_key` (예: `personal`)


## 환경변수 (fallback)

- `MEMORY_CORE_AUDIT_SLACK_WEBHOOK_URL`
- `MEMORY_CORE_AUDIT_SLACK_ACTION_PREFIXES`
- `MEMORY_CORE_AUDIT_SLACK_DEFAULT_CHANNEL`
- `MEMORY_CORE_AUDIT_SLACK_FORMAT`
- `MEMORY_CORE_AUDIT_SLACK_INCLUDE_TARGET_JSON`
- `MEMORY_CORE_AUDIT_SLACK_MASK_SECRETS`


## 단계별 설정

1. Slack webhook 생성
- Slack 앱에서 webhook URL을 발급합니다.
- webhook URL은 시크릿으로 관리하세요.

2. Admin UI에서 저장
- `admin-ui` -> Integrations -> Slack Audit으로 이동
- 저장 값:
  - `enabled=true`
  - `webhook_url`
  - `default_channel` (선택)
  - `action_prefixes` (선택 필터)
  - `format` (`detailed` 또는 `compact`)
  - `include_target_json` / `mask_secrets`
  - 선택: `routes`, `severity_rules`

3. API로 저장(선택)

```bash
curl -X PUT "$MEMORY_CORE_URL/v1/integrations" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_key": "personal",
    "provider": "slack",
    "enabled": true,
    "reason": "slack 감사 알림 활성화",
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

4. 트리거 및 검증
- 감사 이벤트가 발생하는 동작(예: integration 저장 + `reason`)을 실행합니다.
- Slack 채널에서 메시지 수신을 확인합니다.
- API 감사 로그도 확인합니다.

```bash
curl -G "$MEMORY_CORE_URL/v1/audit-logs" \
  -H "Authorization: Bearer $MEMORY_CORE_API_KEY" \
  --data-urlencode "workspace_key=personal" \
  --data-urlencode "action_prefix=integration." \
  --data-urlencode "limit=20"
```


## 설정 키 레퍼런스

- `webhook_url`: Incoming webhook 주소
- `default_channel`: 기본 라우팅 채널
- `action_prefixes`: prefix 매칭 시에만 알림 전송
- `format`: `detailed` 또는 `compact`
- `include_target_json`: 감사 target JSON 포함 여부
- `mask_secrets`: 토큰/시크릿 마스킹
- `routes`: `[{ action_prefix, channel?, min_severity? }]`
- `severity_rules`: `[{ action_prefix, severity }]`

severity 값:
- `low`
- `medium`
- `high`
- `critical`


## env vs Admin UI 우선순위

- 기본: Admin UI 워크스페이스 설정이 env fallback보다 우선합니다.
- 예외: `audit_reasoner`는 `ENV > Admin UI` 우선순위를 사용합니다.
  - env 키: `MEMORY_CORE_AUDIT_REASONER_*`, `OPENAI_API_KEY`, `GEMINI_API_KEY`
  - Admin UI fallback: Integrations -> Audit Reasoner
- 잠금 옵션:
  - `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=slack`
  - 잠금 시 Admin UI 수정이 거부되고 env-only 모드가 강제됩니다.


## 트러블슈팅

- Slack 메시지가 안 옴
  - webhook URL 유효성, `enabled=true` 확인
  - `action_prefixes` 설정 시 prefix 매칭 여부 확인
  - `routes.min_severity` 설정 시 임계치 조건 확인
- `Integration provider "slack" is locked...`
  - `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS`에서 `slack` 제거 또는 env-only로 운영
