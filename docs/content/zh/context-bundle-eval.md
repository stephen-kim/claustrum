# 上下文包评估

用于持续验证 `/v1/context/bundle` 质量的评估套件。

## 能做什么

- 题集批量执行
- 规则打分
- run 间 diff
- 可选 LLM judge

## 结构

- `eval/questions.yaml`
- `scripts/eval/run_bundle_eval.ts`
- `scripts/eval/score_bundle.ts`
- `scripts/eval/diff_bundle.ts`
- `scripts/eval/render_diff_html.ts`
- `scripts/eval/token_count.ts`
- `scripts/eval/helpers.ts`

输出：
- `eval/runs/<timestamp>/bundle.jsonl`
- `eval/runs/<timestamp>/scores.json`
- `eval/runs/<timestamp>/report.md`
- `eval/runs/<timestamp>/diff.md`
- `eval/runs/<timestamp>/diff.html`

## 运行

```shell
pnpm eval:bundle
```

常用参数：

```shell
pnpm eval:bundle -- --base-url http://localhost:8080
pnpm eval:bundle -- --limit 10
pnpm eval:bundle -- --debug true
pnpm eval:bundle -- --mask true
```

## 评分逻辑

`score_bundle.ts` 会检查：

- `must_include_types`
- `must_not_include_types`
- `should_include_keywords`
- `must_include_fields`
- token budget 超限惩罚

## run 对比

```shell
pnpm eval:diff -- --a eval/runs/<runA> --b eval/runs/<runB>
```

比较内容：
- global rule IDs
- top decisions
- active work
- retrieval IDs + score breakdown
- token usage

## LLM Judge（可选）

```shell
EVAL_JUDGE_PROVIDER=openai \
EVAL_JUDGE_API_KEY=*** \
pnpm eval:bundle -- --judge true
```

支持：`openai`, `claude`, `gemini`

## 安全注意

- 不打印/保存 API key
- `workspace_key`/`project_key` 可用于报告
- 认证使用 `MEMORY_CORE_API_KEY`
