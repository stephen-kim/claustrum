# 전역 규칙


Claustrum은 두 가지 전역 규칙 범위를 지원합니다.

- `workspace` 전역 규칙: 작업 공간의 모든 사람이 공유합니다.
- `user` 전역 규칙: 작업 공간 내 특정 사용자에 대한 개인 규칙입니다.

## 디자인 목표

- "최대 5개 규칙"과 같은 하드 캡이 없습니다.
- 하드 잘림 대신 토큰 예산 + 점수 기반 선택을 사용합니다.
- 중요한 규칙(`pinned` / `high`)을 높은 우선순위로 유지하세요.
- 부드러운 지침과 요약 대체를 통해 품질을 유지합니다.

## 규칙 필드

각 규칙에는 다음이 저장됩니다.

- `title`, `content`
- `category`: `policy | security | style | process | other`
- `priority`: `1..5`
- `severity`: `low | medium | high`
- `pinned`, `enabled`

## API

- `GET /v1/global-rules?workspace_key=...&scope=workspace|user&user_id?`
- `POST /v1/global-rules`
- `PUT /v1/global-rules/:id`
- `DELETE /v1/global-rules/:id`
- `POST /v1/global-rules/summarize`

### 엔드포인트 요약

`POST /v1/global-rules/summarize`

본체:

```json
{
  "workspace_key": "personal",
  "scope": "workspace",
  "mode": "preview"
}
```
모드:

- `preview`: 요약 텍스트만 반환합니다.
- `replace`: 번들 압축을 위해 `global_rule_summaries`을 upsert합니다.

## 소프트 가드레일

작업 공간 설정 제어 지침 임계값:

- `global_rules_recommend_max`(기본값 `5`)
- `global_rules_warn_threshold`(기본값 `10`)

행동:

- 권장 최대치 이상: 정보 수준 안내.
- 경고 임계값 초과: 경고 수준 품질 경고입니다.

## 관리 UI

`Workspace → Global Rules`

- 작업공간/사용자 범위 규칙에 대한 CRUD.
- 심각도, 우선순위, 고정, 활성화를 설정합니다.
- 추천/경고 뱃지를 확인하세요.
- 자동 요약(`preview` / `apply`).
- 선택 모드 및 예산 비율을 구성합니다.

## 보안 및 권한

- 작업공간 범위 규칙: 작업공간 관리자가 필요합니다.
- 사용자 범위 규칙: 자체 또는 작업 영역 관리자.
- 요약 적용은 `global_rules.summarized` 감사 이벤트를 작성합니다.
