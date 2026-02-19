# 검색순위(하이브리드)

Claustrum 검색은 기본적으로 하이브리드 검색을 사용하며 예측 가능한 향상을 적용합니다.

## 기본 검색

- `keyword`: Postgres FTS 후보
- `semantic`: 유사성 후보 삽입
- `hybrid`: 키워드 + 의미점수의 가중치 조합

## 작업 공간 조정 가능 부스트

작업공간 설정은 순위 동작을 제어합니다.

- `search_type_weights`(JSON 맵)
- `search_recency_half_life_days` (기본값 14)
- `search_subpath_boost_weight` (기본값 1.5)

## 유효 점수

`final = base_score * type_boost * recency_boost * subpath_boost`

어디에:

- `type_boost`은 의사결정/제약이 많은 컨텍스트를 선호합니다.
- `recency_boost` 반감기로 붕괴
- `subpath_boost`은 `metadata.subpath`이 현재 하위 경로와 일치할 때 공유 모노레포 모드에서 적용됩니다.

## 디버그 분석

`debug=true`인 경우 각 결과에는 다음이 포함될 수 있습니다.

- `vector`
- `fts`
- `type_boost`
- `recency_boost`
- `subpath_boost`
- `final`

최종 업데이트 날짜: 2026-02-17