# 관리자 추출 설정

이 페이지를 사용하여 원시 Git 활동이 `activity` 및 `decision` 추억이 되는 방식을 제어하세요.

로캘 설정은 추출 동작이 아닌 아웃바운드 통합(Slack/Jira/Confluence/Notion)에만 적용됩니다.

## 구성 위치

관리 콘솔에서:

- `Project Resolution Settings` -> 추출 파이프라인
- `Decision Keyword Policies`
- `Decisions`

## 추출 파이프라인 설정

- `enable_activity_auto_log`
  - 모든 커밋/병합에 대해 `activity` 메모리를 생성합니다.
- `enable_decision_extraction`
  - 비동기 LLM 결정 추출을 활성화합니다.
- `decision_extraction_mode`
  - `llm_only`: 최신순으로 처리됩니다.
  - `hybrid_priority`: 높은 점수를 받은 이벤트를 먼저 처리합니다.
- `decision_default_status`
  - LLM이 만든 결정에 대한 기본 상태입니다.
- `decision_auto_confirm_enabled`
  - 선택적으로 자동 확인됩니다.
- `decision_auto_confirm_min_confidence`
  - 자동 확인을 위한 임계값입니다.
- `decision_batch_size`
  - 추출 실행당 최대 이벤트입니다.
- `decision_backfill_days`
  - 보류 중인 이벤트에 대한 전환 확인 기간입니다.

## 키워드 정책(예약 전용)

각 정책에는 다음이 포함됩니다.

- 포함/제외 키워드
- 긍정/부정 파일 경로 패턴
- 양수/음수 가중치
- 활성화된 토글

키워드 정책은 LLM 작업의 우선순위를 지정하는 데 사용됩니다.

그들은 사건이 결정인지 여부를 결정하지 **않습니다**.

## 결정 패널

패널은 다음을 제공합니다.

- 필터: 프로젝트, 상태, 신뢰 범위
- 증거 가시성 : `raw_event_id`, `commit_sha`
- 액션: `Confirm`, `Reject`

## 권장 기본값

- `enable_activity_auto_log = true`
- `enable_decision_extraction = true`
- `decision_extraction_mode = llm_only`
- `decision_default_status = draft`
- `decision_auto_confirm_enabled = false`
- `decision_auto_confirm_min_confidence = 0.90`
- `decision_batch_size = 25`
- `decision_backfill_days = 30`