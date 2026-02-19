# 컨텍스트 예산

최종 업데이트 날짜: 2026-02-18

Claustrum은 고정 개수 클리핑 대신 토큰 예산 분할을 사용하여 컨텍스트를 묶습니다.

## 작업공간 설정

- `bundle_token_budget_total`(기본값 `3000`)
- `bundle_budget_global_workspace_pct`(기본값 `0.15`)
- `bundle_budget_global_user_pct`(기본값 `0.10`)
- `bundle_budget_project_pct`(기본값 `0.45`)
- `bundle_budget_retrieval_pct`(기본값 `0.30`)

## 효과적인 할당

총 예산 `B`의 경우:

- 워크스페이스 전체 예산 = `B * workspace_pct`
- 사용자 전체 예산 = `B * user_pct`
- 검색 예산 = `B * retrieval_pct`
- 프로젝트 스냅샷 예산은 제한된 스냅샷 섹션으로 표시됩니다.

## 전역 규칙 선택

선택 순서:

1. 고정된 규칙을 먼저 포함합니다.
2. 다음에 심각도가 높은 규칙을 포함합니다(고정 후 예산이 허용하는 경우).
3. 구성된 모드를 통해 남은 예산을 채웁니다.
   - `score`
   - `recent`
   - `priority_only`

규칙 수가 많고 요약이 활성화된 경우 생략된 규칙은 요약 텍스트를 통해 표시됩니다.

## 디버그 가시성

`GET /v1/context/bundle?...&mode=debug`

디버그 페이로드에는 다음이 포함됩니다.

- 범위별 글로벌 예산
- 선택/생략 개수
- 선택 모드
- 메모리 히트에 대한 검색 점수 분석

## 튜닝 권장사항

- `0.20 ~ 0.35` 주변에 `global_workspace_pct + global_user_pct`을 유지하세요.
- 쿼리 기반 회수를 위해 검색 예산을 충분히 높게 유지합니다(`>= 0.25`).
- 규칙이 커지면 엄격한 제한을 적용하는 대신 요약 사용을 늘립니다.