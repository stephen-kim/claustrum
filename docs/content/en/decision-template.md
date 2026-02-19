# Decision Template

Decision extraction is forced into a fixed shape for stable retrieval quality.

## Required Sections

Every decision memory content is normalized to include:

- `Summary:`
- `Why:`
- `Alternatives:`
- `Impact:`
- `Evidence:`

## Formatting Rules

- Summary: 1-2 lines
- Why/Alternatives/Impact: 1-3 bullets each
- Evidence: include commit/raw evidence references whenever available

## Enforcement

- LLM extractor prompt asks for strict structured output.
- Server-side normalization fills missing sections automatically.
- Even when data is missing, section headers are preserved.

## Example

```text
Summary:
Switch memory search to hybrid ranking with explicit debug scores.

Why:
- Keyword-only ranking missed high-quality decisions.
- Teams needed consistent quality controls.

Alternatives:
- Keep keyword-only retrieval.
- Use semantic-only retrieval.

Impact:
- Recall quality improves for cross-session workflows.
- Debug mode can explain ranking details.

Evidence:
- commit_sha: 8c3f0a12d9
- raw_event_id: 8d53cceb-2aab-4f08-9bf4-b038b5f76f33
```
