# 보안 분류

Claustrum은 보안 관련 감사 트래픽과 일반 운영 감사 트래픽을 분리합니다.

## 보안 조치 범위

보안 스트림에는 다음이 포함됩니다.

- `auth.*`
- `access.*`
- `api_key.*`
- `raw.search`
- `raw.view`
- `audit.export`
- `oidc.*`
- `github.permissions.*`
- `security.*`

## 카테고리 매핑

- `auth.*`, `oidc.*` → `auth`
- `access.*`, `github.permissions.*`, `security.*` → `access`
- `raw.search`, `raw.view`, `audit.export` → `data`
- `api_key.*` → `config`

## 심각도 매핑

기본 심각도:

- `high`: `api_key.*`, `audit.export`, `security.*`, 인증 실패/취소
- `medium`: `auth.*`, `access.*`, `raw.search`, `raw.view`, `oidc.*`, `github.permissions.*`
- `low`: 대체

`audit_logs.target`은 다음을 명시적으로 재정의할 수 있습니다.

```json
{
  "category": "auth",
  "severity": "high"
}
```
## 작업 공간 제어

`workspace_settings`:

- `security_stream_enabled`(기본값 `true`)
- `security_stream_sink_id`(전용 싱크 옵션)
- `security_stream_min_severity`(`low|medium|high`, 기본값 `medium`)

전용 싱크가 설정되지 않은 경우 Claustrum은 활성화된 보안 가능 싱크로 대체됩니다.
