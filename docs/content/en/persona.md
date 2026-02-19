# Persona

Persona controls how Claustrum weights context for each user.
It changes retrieval emphasis, not permissions and not role membership.

## Persona Modes

- `neutral` (default): balanced retrieval with a slight active-work boost.
- `author`: implementation-focused; favors active work and recent activity.
- `reviewer`: risk and correctness-focused; favors constraints and decisions.
- `architect`: system design-focused; favors decisions and constraints.

## Recommendation (Hint Only)

Endpoint:

- `GET /v1/context/persona-recommendation?workspace_key=...&project_key=...&q=...`

Behavior:

- Rule-based recommendation.
- Never auto-switches user persona.
- User persona remains source of truth until manually changed.

## Apply Flow

1. Open **Context Debug**.
2. Run recommendation with current query.
3. Click **Apply Recommended Persona** if desired.

Applied change is audited with `user.persona.changed`.

Last Updated: 2026-02-18
