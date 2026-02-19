# コンテキストバンドル評価

`/v1/context/bundle` の品質を継続的に確認する評価スイートです。

## できること

- 質問セット実行
- ルールベース採点
- run 間 diff
- 任意で LLM judge

## 構成

- `eval/questions.yaml`
- `scripts/eval/run_bundle_eval.ts`
- `scripts/eval/score_bundle.ts`
- `scripts/eval/diff_bundle.ts`
- `scripts/eval/render_diff_html.ts`
- `scripts/eval/token_count.ts`
- `scripts/eval/helpers.ts`

出力:
- `eval/runs/<timestamp>/bundle.jsonl`
- `eval/runs/<timestamp>/scores.json`
- `eval/runs/<timestamp>/report.md`
- `eval/runs/<timestamp>/diff.md`
- `eval/runs/<timestamp>/diff.html`

## 実行

```bash
pnpm eval:bundle
```

よく使うオプション:

```bash
pnpm eval:bundle -- --base-url http://localhost:8080
pnpm eval:bundle -- --limit 10
pnpm eval:bundle -- --debug true
pnpm eval:bundle -- --mask true
```

## 採点ロジック

`score_bundle.ts` は次を使って採点します。

- `must_include_types`
- `must_not_include_types`
- `should_include_keywords`
- `must_include_fields`
- token budget 超過ペナルティ

## run 比較

```bash
pnpm eval:diff -- --a eval/runs/<runA> --b eval/runs/<runB>
```

比較対象:
- global rule IDs
- top decisions
- active work
- retrieval IDs + score breakdown
- token usage breakdown

## LLM Judge（任意）

```bash
EVAL_JUDGE_PROVIDER=openai \
EVAL_JUDGE_API_KEY=*** \
pnpm eval:bundle -- --judge true
```

provider: `openai`, `claude`, `gemini`

## セキュリティ注意

- API key を出力/保存しない
- `workspace_key` / `project_key` は出力可
- 認証は `MEMORY_CORE_API_KEY` を利用

最終更新: 2026-02-19
