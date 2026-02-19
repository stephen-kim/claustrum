# Context Bundle Eval


## Purpose

Context Bundle Eval provides continuous quality checks for `/v1/context/bundle`.

It combines:
- question-set execution
- rule-based scoring
- run-to-run diff
- optional LLM judge


## Structure

- `eval/questions.yaml` (20 sample questions)
- `scripts/eval/run_bundle_eval.ts`
- `scripts/eval/score_bundle.ts`
- `scripts/eval/diff_bundle.ts`
- `scripts/eval/render_diff_html.ts`
- `scripts/eval/token_count.ts`
- `scripts/eval/helpers.ts`

Run outputs:
- `eval/runs/<timestamp>/bundle.jsonl`
- `eval/runs/<timestamp>/scores.json`
- `eval/runs/<timestamp>/report.md`
- `eval/runs/<timestamp>/diff.md` (when diffing)
- `eval/runs/<timestamp>/diff.html` (when diffing)


## Run Eval

```bash
pnpm eval:bundle
```

Common options:

```bash
pnpm eval:bundle -- --base-url http://localhost:8080
pnpm eval:bundle -- --limit 10
pnpm eval:bundle -- --debug true
pnpm eval:bundle -- --mask true
pnpm eval:bundle -- --out-dir eval/runs/manual-01
```

Notes:
- `--debug true` stores debug bundle per case in JSONL entry.
- `--mask true` masks sensitive token/key fields before persisting outputs.


## Rule-Based Scoring

`score_bundle.ts` evaluates each case using `expected` rules:
- `must_include_types`
- `must_not_include_types`
- `should_include_keywords`
- `must_include_fields`
- token budget penalty when over budget

Outputs:
- `scores.json` (case scores, totals, reasons)
- `report.md` (summary + fail top cases)


## Diff Two Runs

```bash
pnpm eval:diff -- --a eval/runs/<runA> --b eval/runs/<runB>
```

Compared dimensions:
- global rule selected IDs
- `snapshot.top_decisions` (`id:title`)
- `snapshot.active_work` titles
- retrieval IDs + score breakdown
- token usage breakdown

Outputs in run B directory by default:
- `diff.json`
- `diff.md`
- `diff.html`

Color conventions in HTML:
- added: green
- removed: red
- changed: yellow


## Optional LLM Judge

LLM judge is optional and disabled by default.

Enable:

```bash
EVAL_JUDGE_PROVIDER=openai \
EVAL_JUDGE_API_KEY=*** \
pnpm eval:bundle -- --judge true
```

Supported providers:
- `openai`
- `claude`
- `gemini`

Judge returns:
- score (1..5)
- reasons (up to 3 bullets)
- suggestions (up to 3 bullets)

When env vars are missing, judge is skipped and scoring stays rule-based only.


## Report Helpers

Show latest report:

```bash
pnpm eval:report
```


## Security Notes

- Do not print or store API keys in eval outputs.
- `workspace_key` / `project_key` are allowed in reports.
- Use environment variables for auth:
  - `MEMORY_CORE_API_KEY`


## CI Guidance (Optional)

Recommended CI pattern:
1. Run `pnpm eval:bundle` against staging memory-core.
2. Store `report.md` + `scores.json` as artifacts.
3. Compare with previous baseline using `pnpm eval:diff`.


## PR Comment Integration

Workflow:
- `.github/workflows/eval-comment.yml`

Behavior on `pull_request` (`opened`, `synchronize`, `reopened`):
1. Runs eval on PR HEAD (`eval/runs/pr-head`)
2. Tries optional base eval on `origin/<base_ref>` (`eval/runs/pr-base`)
3. Generates diff (`diff.md`, `diff.html`) when base run exists
4. Posts/updates a sticky PR comment (header-based update)

Sticky marker in comment body:
- `<!-- CLAUSTRUM_EVAL_COMMENT -->`

Comment includes:
- total score / failing case count
- top failures (up to 5)
- budget overrun cases
- MCP tool schema snapshot guard status
- diff summary
- link to workflow artifacts

Schema guard details:
- Runs `apps/mcp-adapter/src/tools-schema.snapshot.test.ts`
- Writes `schema-snapshot.json` and `schema-snapshot.log` to `eval/runs/pr-head/`
- Fails the workflow at the end if snapshot drift is detected (after comment + artifacts are published)


## Troubleshooting

- `scores.json not found`
  - verify `pnpm eval:bundle` completed
  - verify output folder exists under `eval/runs/<id>`

- Diff not generated
  - base eval may fail (network/time/resource limits)
  - check `eval/runs/pr-base/bundle.jsonl` existence

- All HTTP checks fail
  - confirm `memory-core` health endpoint is reachable
  - confirm `MEMORY_CORE_API_KEY` is set for eval runner

- Judge is skipped unexpectedly
  - confirm `--judge true`
  - confirm both `EVAL_JUDGE_PROVIDER` and `EVAL_JUDGE_API_KEY`


Last Updated: 2026-02-18
