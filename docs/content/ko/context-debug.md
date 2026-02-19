# 컨텍스트 디버그

컨텍스트 디버그는 번들에 현재 결과가 포함된 이유를 설명합니다.

## 검사할 수 있는 사항

- 액티브 페르소나와 추천 페르소나
- 추천 이유와 신뢰도
- 전역 규칙 라우팅 모드 및 선택된 규칙
- 점수 분석이 가능한 활성 직업 후보자
- 검색 점수 분석(FTS/벡터 + 부스트)
- 섹션별 토큰 예산 할당
- 액티브 워크 정책(`stale_days`, `auto_close`)

## 컨텍스트 번들 디버그 계약

사용:

- `GET /v1/context/bundle?...&mode=debug`

디버그에는 다음이 포함됩니다.

- `persona_applied`
- `persona_recommended`
- `weight_adjustments`
- `active_work_candidates`
- `active_work_policy`
- `token_budget`

## 재정의

관리 UI 컨텍스트 디버그에서:

- 추천 페르소나 적용(수동 조치)
- 활성 작업 확인/고정
- 활성 작업 닫기/다시 열기

이러한 제어는 자동화를 투명하게 유지하고 관리자가 제어할 수 있도록 의도적으로 명시적입니다.

최종 업데이트 날짜: 2026-02-18