# CI

## 개요

Claustrum CI는 모든 풀 요청과 `main`에 대한 모든 푸시에 대해 **release-gate** 작업을 실행합니다.

작업에서는 다음을 사용합니다.
- `pnpm` 작업공간 설치/캐시
- `docker compose` (localdb 프로필)
- `scripts/release-gate.sh` `RELEASE_GATE_RESET_DB=true`와 함께

## 작업 흐름

파일:
- `.github/workflows/ci.yml`

트리거:
- `pull_request`
- `main`의 `push`

직업:
- `release-gate` (`ubuntu-latest`, `timeout-minutes: 20`)

주요 실행 흐름:
1. 결제
2. pnpm + 노드 20 설정
3. `pnpm install --frozen-lockfile`
4. CI 기본값을 위해 `.env` 준비
5. `pnpm lint`
6. `pnpm test`
7. `./scripts/release-gate.sh` (`RELEASE_GATE_RESET_DB=true`)
8. 항상 작성 정리를 실행하세요: `docker compose ... down -v --remove-orphans`

## 문서 페이지 워크플로

파일:
- `.github/workflows/docs-pages.yml`

가드레일 구축:
- 문서가 빌드되기 전에 메모리 코어 경로에서 `/apps/docs-site/public/openapi.json`을 생성합니다.
- 페이지에 게시하기 전에 생성된 사양(`paths` 및 엔드포인트 통계)을 검증합니다.
- Docs 빌드에서는 `/docs/api`의 Scalar API Explorer를 사용합니다.

처음 성공적으로 배포하기 전 요구 사항:
1. 리포지토리 **설정 → 페이지**가 활성화되어 있어야 합니다.
2. 빌드 및 배포 소스는 **GitHub Actions**이어야 합니다.

이것이 활성화되지 않으면 다음과 같은 이유로 배포 단계가 실패할 수 있습니다.
- `Error: Failed to create deployment (status: 404)`

## 평가 코멘트 작업 흐름

파일:
- `.github/workflows/eval-comment.yml`

하이라이트:
- PR 헤드에서 컨텍스트 번들 평가를 실행합니다(선택적 기본 실행 + diff).
- 점수, 실패, 예산 경고 및 차이점 요약이 포함된 고정 PR 댓글을 추가/업데이트합니다.
- MCP 스키마 스냅샷 가드(`tools-schema.snapshot.test.ts`)를 실행하고 댓글에 상태를 보고합니다.
- 스냅샷 가드가 실패하더라도 평가 아티팩트를 업로드한 후 마지막에 작업이 실패합니다.

## 지역 복제

동일한 게이트를 로컬에서 실행합니다.

```shell
RELEASE_GATE_RESET_DB=true ./scripts/release-gate.sh
```text
## 환경 관리

CI는 `.env.example`에서 로컬 `.env` 파일을 작성한 다음 비밀이 아닌 CI 기본값을 추가합니다.
- `DATABASE_URL`
- `MEMORY_CORE_API_KEY`
- `MEMORY_CORE_SEED_ADMIN_KEY`
- `NEXT_PUBLIC_MEMORY_CORE_URL`
- `GITHUB_APP_WEBHOOK_SECRET`

생산 비밀은 커밋되거나 인쇄되지 않습니다.

`scripts/release-gate.sh`은 QC 로그의 민감한 값도 마스킹합니다.

## 실패 아티팩트

실패 시 CI는 다음을 업로드합니다.
- `release-gate-logs` 유물
- 출처 : `memory-core` 작성 로그 마지막 200줄
- 부트스트랩 비밀번호/API 키와 유사한 토큰에 대해 마스크됨

## 문제 해결

- QC가 시작되기 전에 CI가 실패하는 경우:
  - `pnpm install --frozen-lockfile` 확인 및 잠금 파일 드리프트
- `@claustrum/shared/dist/index.js`에 대해 `ERR_MODULE_NOT_FOUND`으로 단위 테스트가 실패하는 경우:
  - `memory-core` 테스트 전에 공유가 빌드되었는지 확인하세요.
    - `pnpm --filter @claustrum/shared build`
  - 현재 `memory-core` 테스트 스크립트에는 기본적으로 이 사전 빌드 단계가 이미 포함되어 있습니다.
- 부트스트랩 QC에서 CI가 실패하는 경우:
  - 작성 프로필이 `localdb`인지 확인하세요.
  - `POSTGRES_DB`, `POSTGRES_USER` 및 `POSTGRES_PASSWORD`이 실제 값으로 설정되었는지 확인합니다(`<db_user>`과 같은 자리 표시자 문자열이 아님).
  - `MEMORY_CORE_RUN_SEED=false`(릴리스 게이트 기본값)이 유효한지 확인하세요.
- 웹훅 QC에서 CI가 실패하는 경우:
  - Compose Env에 `GITHUB_APP_WEBHOOK_SECRET`이 있는지 확인하세요.
- 정리에 실패한 경우:
  - 수동 정리 실행:
    - `docker compose -f docker-compose.dev.yml --profile localdb down -v --remove-orphans`
