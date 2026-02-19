# Evaluación de Context Bundle

Suite para validar de forma continua la calidad de `/v1/context/bundle`.

## Incluye

- ejecución de set de preguntas
- scoring basado en reglas
- diff entre runs
- LLM judge opcional

## Estructura

- `eval/questions.yaml`
- `scripts/eval/run_bundle_eval.ts`
- `scripts/eval/score_bundle.ts`
- `scripts/eval/diff_bundle.ts`
- `scripts/eval/render_diff_html.ts`
- `scripts/eval/token_count.ts`
- `scripts/eval/helpers.ts`

Outputs:
- `eval/runs/<timestamp>/bundle.jsonl`
- `eval/runs/<timestamp>/scores.json`
- `eval/runs/<timestamp>/report.md`
- `eval/runs/<timestamp>/diff.md`
- `eval/runs/<timestamp>/diff.html`

## Ejecutar

```bash
pnpm eval:bundle
```

Opciones comunes:

```bash
pnpm eval:bundle -- --base-url http://localhost:8080
pnpm eval:bundle -- --limit 10
pnpm eval:bundle -- --debug true
pnpm eval:bundle -- --mask true
```

## Scoring

`score_bundle.ts` usa:

- `must_include_types`
- `must_not_include_types`
- `should_include_keywords`
- `must_include_fields`
- penalización por exceder token budget

## Diff entre runs

```bash
pnpm eval:diff -- --a eval/runs/<runA> --b eval/runs/<runB>
```

Compara:
- IDs de global rules
- top decisions
- active work
- retrieval IDs + score breakdown
- token usage

## LLM Judge (opcional)

```bash
EVAL_JUDGE_PROVIDER=openai \
EVAL_JUDGE_API_KEY=*** \
pnpm eval:bundle -- --judge true
```

Providers: `openai`, `claude`, `gemini`

## Seguridad

- no imprimir ni guardar API keys
- `workspace_key`/`project_key` sí pueden aparecer en reportes
- auth por `MEMORY_CORE_API_KEY`

Última actualización: 2026-02-19
