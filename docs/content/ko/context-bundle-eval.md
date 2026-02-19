# 컨텍스트 번들 평가

## 목적

Context Bundle Eval은 `/v1/context/bundle`에 대한 지속적인 품질 검사를 제공합니다.

이는 다음을 결합합니다:
- 질문 세트 실행
- 규칙 기반 채점
- 실행 간 차이
- 선택적인 LLM 판사

## 구조

- `eval/questions.yaml` (샘플 20개)
- `scripts/eval/run_bundle_eval.ts`
- `scripts/eval/score_bundle.ts`
- `scripts/eval/diff_bundle.ts`
- `scripts/eval/render_diff_html.ts`
- `scripts/eval/token_count.ts`
- `scripts/eval/helpers.ts`

실행 출력:
- `eval/runs/<timestamp>/bundle.jsonl`
- `eval/runs/<timestamp>/scores.json`
- `eval/runs/<timestamp>/report.md`
- `eval/runs/<timestamp>/diff.md` (비교 시)
- `eval/runs/<timestamp>/diff.html` (비교 시)

## 평가 실행

```shell
pnpm eval:bundle
```
일반적인 옵션:

```shell
pnpm eval:bundle -- --base-url http://localhost:8080
pnpm eval:bundle -- --limit 10
pnpm eval:bundle -- --debug true
pnpm eval:bundle -- --mask true
pnpm eval:bundle -- --out-dir eval/runs/manual-01
```
참고:
- `--debug true`은 JSONL 항목에 사례별로 디버그 번들을 저장합니다.
- `--mask true`은 출력을 유지하기 전에 민감한 토큰/키 필드를 마스킹합니다.

## 규칙 기반 점수 매기기

`score_bundle.ts`은 `expected` 규칙을 사용하여 각 사례를 평가합니다.
- `must_include_types`
- `must_not_include_types`
- `should_include_keywords`
- `must_include_fields`
- 예산 초과 시 토큰 예산 페널티

출력:
- `scores.json`(사례점수, 합계, 사유)
- `report.md`(요약 + 실패 사례)

## 두 번의 실행 비교

```shell
pnpm eval:diff -- --a eval/runs/<runA> --b eval/runs/<runB>
```
비교된 치수:
- 전역 규칙 선택 ID
- `snapshot.top_decisions` (`id:title`)
- `snapshot.active_work` 제목
- 검색 ID + 점수 분석
- 토큰 사용 내역

기본적으로 실행 B 디렉터리에 출력됩니다.
- `diff.json`
- `diff.md`
- `diff.html`

HTML의 색상 규칙:
- 추가됨: 녹색
- 제거됨: 빨간색
- 변경 : 노란색

## 선택적 LLM 판사

LLM 판사는 선택 사항이며 기본적으로 비활성화되어 있습니다.

실행 방법:

```shell
EVAL_JUDGE_PROVIDER=openai \
EVAL_JUDGE_API_KEY=*** \
pnpm eval:bundle -- --judge true
```
지원되는 제공업체:
- `openai`
- `claude`
- `gemini`

판사는 다음과 같이 반환합니다.
- 점수(1..5)
- 사유(최대 3개)
- 제안(최대 3개 글머리 기호)

환경 변수가 누락되면 심사를 건너뛰고 채점은 규칙 기반으로만 유지됩니다.

## 보고서 도우미

최신 보고서 표시:

```shell
pnpm eval:report
```
## 보안 참고 사항

- 평가 출력에 API 키를 인쇄하거나 저장하지 마세요.
- 보고서에는 `workspace_key` / `project_key`이 허용됩니다.
- 인증을 위해 환경 변수를 사용합니다.
  - `MEMORY_CORE_API_KEY`

## CI 지침(선택사항)

권장 CI 패턴:
1. 스테이징 메모리 코어에 대해 `pnpm eval:bundle`을 실행합니다.
2. `report.md` + `scores.json`을 아티팩트로 저장합니다.
3. `pnpm eval:diff`을 사용하여 이전 기준과 비교합니다.

## 홍보댓글 통합

작업 흐름:
- `.github/workflows/eval-comment.yml`

`pull_request`(`opened`, `synchronize`, `reopened`)의 동작:
1. PR HEAD(`eval/runs/pr-head`)에서 평가를 실행합니다.
2. `origin/<base_ref>`(`eval/runs/pr-base`)에서 선택적 기본 평가를 시도합니다.
3. 베이스런이 존재하는 경우 diff(`diff.md`, `diff.html`)를 생성합니다.
4. 고정 PR 댓글 게시/업데이트(헤더 기반 업데이트)

댓글 본문의 고정 마커:
- `<!-- CLAUSTRUM_EVAL_COMMENT -->`

댓글에는 다음이 포함됩니다.
- 총점 / 불합격 건수
- 상위 실패(최대 5개)
- 예산 초과 사례
- MCP 도구 스키마 스냅샷 가드 상태
- 차이점 요약
- 워크플로 아티팩트에 대한 링크

스키마 가드 세부정보:
- `apps/mcp-adapter/src/tools-schema.snapshot.test.ts` 실행
- `schema-snapshot.json` 및 `schema-snapshot.log`을 `eval/runs/pr-head/`에 씁니다.
- 스냅샷 드리프트가 감지되면 마지막에 워크플로가 실패합니다(댓글 + 아티팩트가 게시된 후).

## 문제 해결

- `scores.json not found`
  - `pnpm eval:bundle` 확인 완료
  - `eval/runs/<id>` 아래에 출력 폴더가 있는지 확인하세요.

- 차이가 생성되지 않음
  - 기본 평가가 실패할 수 있음(네트워크/시간/리소스 제한)
  - `eval/runs/pr-base/bundle.jsonl` 존재 확인

- 모든 HTTP 검사가 실패합니다.
  - `memory-core` 상태 엔드포인트에 연결할 수 있는지 확인하세요.
  - `MEMORY_CORE_API_KEY`이 평가 실행기로 설정되어 있는지 확인하세요.

- 판사가 예기치 않게 건너뛰었습니다.
  - `--judge true` 확인
  - `EVAL_JUDGE_PROVIDER` 및 `EVAL_JUDGE_API_KEY`을 모두 확인하세요.
