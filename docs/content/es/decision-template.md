# Plantilla de decisiones

Para mantener calidad consistente, la extracción de decisiones usa formato fijo.

## Secciones obligatorias

Cada decision debe incluir:

- `Summary:`
- `Why:`
- `Alternatives:`
- `Impact:`
- `Evidence:`

## Reglas de formato

- Summary: 1-2 líneas
- Why / Alternatives / Impact: 1-3 bullets por sección
- Evidence: incluir `commit_sha` / `raw_event_id` cuando exista

## Cómo se fuerza

- Prompt de extracción exige salida estructurada
- Normalización en servidor completa secciones faltantes
- Si falta información, igual se conservan headers

## Ejemplo

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
