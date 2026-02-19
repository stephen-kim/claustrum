# Decision Extraction Pipeline

Claustrum stores all Git raw events, always.

Then it runs a two-stage memory pipeline:

1. Raw Event -> Activity Memory (predictable)
2. Raw Event -> Decision Memory (LLM classification)


## Flow

```mermaid
flowchart TD
  A["Git post-commit / post-merge / post-checkout"] --> B["POST /v1/raw-events"]
  B --> C["raw_events persisted (always)"]
  C --> D{"event_type commit/merge?"}
  D -- "yes" --> E["Create activity memory (type=activity)"]
  D -- "no (checkout)" --> F["Skip activity memory"]
  C --> G{"decision extraction enabled?"}
  G -- "yes" --> H["Async LLM batch job"]
  H --> I{"LLM label=decision?"}
  I -- "yes" --> J["Create decision memory (draft by default)"]
  I -- "no" --> K["Mark event as processed (not_decision)"]
  G -- "no" --> L["No decision job"]
```


## Important Rule: Keywords Are Scheduling Only

`decision_keyword_policies` affects **LLM processing priority only**.

- It does not create memories by itself.
- It does not confirm decisions by itself.
- It only changes queue order when `decision_extraction_mode=hybrid_priority`.


## Decision Status Policy

Default:

- `decision_default_status = draft`
- `decision_auto_confirm_enabled = false`

Optional auto-confirm:

- Enabled only if `decision_auto_confirm_enabled = true`
- Requires `confidence >= decision_auto_confirm_min_confidence`


## LLM Output Contract

The classifier expects strict JSON:

```json
{
  "label": "decision | not_decision",
  "confidence": 0.0,
  "summary": "1-2 lines",
  "reason": ["bullet 1", "bullet 2"],
  "tags": ["optional-tag"]
}
```


## Operational Notes

- If no LLM provider key/config is available, decision extraction is skipped safely and retried later.
- Activity logging is predictable and low-cost.
- Decision extraction cost is controlled by:
  - `decision_batch_size`
  - `decision_backfill_days`
  - `decision_extraction_mode` (`llm_only` vs `hybrid_priority`)
