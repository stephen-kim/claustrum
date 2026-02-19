# Context Bundle Advanced

## Global Section (Advanced)

`GET /v1/context/bundle` now includes routing diagnostics in `global.routing`.

Example fields:

- `mode`: current routing mode
- `q_used`: explicit query or generated pseudo-query
- `selected_rule_ids`: included global rule IDs
- `dropped_rule_ids`: excluded global rule IDs
- `score_breakdown`: available in debug mode

## Debug Workflow

1. Open Admin UI → Context Debug
2. Set query + subpath (optional)
3. Load Debug bundle
4. Compare:
   - retrieval ranking (`retrieval.results[*].score_breakdown`)
   - global rule routing (`global.routing.score_breakdown`)

## Interpretation

- If the right rules are dropped: lower `min_score` or increase `top_k`.
- If noisy rules are selected: raise `min_score`, improve tags, or reduce `top_k`.
- If budget pressure is high: keep pinned rules lean and rely on summary compression.

## Notes

- Raw full text is still excluded from bundle payloads.
- Routing metadata is explanatory; it does not weaken workspace/project authorization.

Last Updated: 2026-02-18
