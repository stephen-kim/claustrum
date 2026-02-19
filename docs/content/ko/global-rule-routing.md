# 전역 규칙 라우팅

## 목적

전역 규칙은 모든 질문에 대해 정적 블록으로 삽입되어서는 안 됩니다.
Claustrum은 규칙을 동적으로 라우팅하므로 중요한 보호 장치를 유지하면서 번들이 관련성을 유지합니다.

## 핵심 규칙

- `pinned=true` 규칙은 항상 포함됩니다.
- `severity=high` 규칙은 항상 포함됩니다(예산 경고가 있을 수 있음).
- 그 외의 룰은 라우팅 점수에 따라 선택됩니다.

## 라우팅 모드

- `semantic`: 토큰 유사성에 중점을 둡니다.
- `keyword`: 직접 키워드/태그 중복에 중점을 둡니다.
- `hybrid`(기본값): 의미 + 키워드 혼합.

작업공간 설정:

- `global_rules_routing_enabled` (기본값: `true`)
- `global_rules_routing_mode` (기본값: `hybrid`)
- `global_rules_routing_top_k` (기본값: `5`)
- `global_rules_routing_min_score` (기본값: `0.2`)

## 점수 모델

고정되지 않은/높지 않은 규칙의 경우:

`score = semantic_similarity * w_sem + keyword_overlap * w_kw + priority_weight + recency_weight - length_penalty`

어디에:

- `semantic_similarity`: 쿼리 및 규칙 토큰에 대한 코사인 유사성입니다.
- `keyword_overlap`: 쿼리 토큰과 규칙 콘텐츠/태그의 중복 비율입니다.
- `priority_weight`: 숫자 우선순위가 낮을수록 가중치가 높아집니다.
- `recency_weight`: 새로운 규칙이 약간 향상됩니다.
- `length_penalty`: 매우 긴 규칙은 약간의 불이익을 받습니다.

## 쿼리 소스

라우팅 쿼리(`q_used`)는 다음 순서로 선택됩니다.

1. `/v1/context/bundle`의 명시적인 `q`
2. 프로젝트 요약, 활성 작업, 최근 활동 및 현재 하위 경로를 기반으로 구축된 의사 쿼리

## 예산 상호작용

라우팅은 먼저 규칙 순위를 매긴 다음 토큰 예산을 적용합니다.
생략된 규칙이 커지면 작업공간 설정에 따라 요약 대체가 사용됩니다.

## 관리 UI

작업 공간 → 전역 규칙:

- 라우팅 활성화 토글
- 라우팅 모드 선택
- `top_k` 입력
- `min_score` 입력

프로젝트 → 컨텍스트 디버그:

- 테스트 쿼리 입력
- 디버그 번들 로드
- 선택/삭제된 규칙 ID 검사 및 점수 분석

## 운영 지침

- 더 나은 집중을 위해 `top_k` 작게(`3~8`) 유지하세요.
- 품질이 낮은 규칙이 너무 많이 나타나면 `min_score`을 늘리세요.
- 키워드 라우팅 품질을 향상하려면 태그(`security`, `commit`, `naming` 등)를 추가하세요.

최종 업데이트 날짜: 2026-02-18