# 최근 변경 사항

설치/CI 안정성, 평가 워크플로우에 영향을 주는 사용자 관점 변경사항만 정리합니다.

## 2026-02-18

### CI 및 테스트 안정성

- `memory-core` 단위 테스트 실행 시 `@claustrum/shared/dist/index.js` 누락으로 실패하던 문제를 수정했습니다.
- 이제 `memory-core` 테스트가 시작되기 전에 `@claustrum/shared`를 선빌드하므로, fresh CI 환경에서 `ERR_MODULE_NOT_FOUND`가 재발하지 않습니다.

### PR Context Bundle Eval 자동화

- Context Bundle Eval 스위트 추가:
  - `pnpm eval:bundle`
  - `pnpm eval:diff`
- PR Sticky Comment 워크플로우 추가:
  - PR HEAD 기준 eval 실행
  - 가능하면 base와 diff 비교
  - 점수/실패 케이스/토큰 예산 경고를 같은 코멘트에 업데이트
  - `report.md`, `scores.json`, diff 산출물 업로드

### Release Gate / QC

- 릴리즈 전 고위험 검증 스크립트 체인 추가:
  - bootstrap setup gating
  - workspace isolation
  - RBAC 검증
  - webhook 서명/중복 전달(idempotency)
  - secret 노출 스캔
- CI에서 release-gate를 비대화형으로 실행하고 compose 정리를 항상 수행합니다.

### 환경변수 템플릿 단순화

- `.env.example`는 시작에 필요한 최소 항목 위주로 유지합니다.
- 전체 환경변수 레퍼런스는 아래 문서에서 관리합니다:
  - `Environment-Variables.ko`

Last Updated: 2026-02-18
