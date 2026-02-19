# Admin Extraction Settings

Use this page to control how raw Git activity becomes `activity` and `decision` memories.

Locale settings are only for outbound integrations (Slack/Jira/Confluence/Notion), not extraction behavior.

## Where To Configure

In Admin Console:

- `Project Resolution Settings` -> Extraction Pipeline
- `Decision Keyword Policies`
- `Decisions`


## Extraction Pipeline Settings

- `enable_activity_auto_log`
  - Create `activity` memory for every commit/merge.
- `enable_decision_extraction`
  - Enable async LLM decision extraction.
- `decision_extraction_mode`
  - `llm_only`: process by recency.
  - `hybrid_priority`: process high-scored events first.
- `decision_default_status`
  - Default status for LLM-created decisions.
- `decision_auto_confirm_enabled`
  - Optional automatic confirmation.
- `decision_auto_confirm_min_confidence`
  - Threshold for auto-confirm.
- `decision_batch_size`
  - Max events per extraction run.
- `decision_backfill_days`
  - Lookback window for pending events.


## Keyword Policies (Scheduling Only)

Each policy contains:

- positive/negative keywords
- positive/negative file path patterns
- positive/negative weights
- enabled toggle

Keyword policies are used to prioritize LLM jobs.

They do **not** decide whether an event is a decision.


## Decisions Panel

The panel provides:

- filters: project, status, confidence range
- evidence visibility: `raw_event_id`, `commit_sha`
- actions: `Confirm`, `Reject`


## Recommended Defaults

- `enable_activity_auto_log = true`
- `enable_decision_extraction = true`
- `decision_extraction_mode = llm_only`
- `decision_default_status = draft`
- `decision_auto_confirm_enabled = false`
- `decision_auto_confirm_min_confidence = 0.90`
- `decision_batch_size = 25`
- `decision_backfill_days = 30`
