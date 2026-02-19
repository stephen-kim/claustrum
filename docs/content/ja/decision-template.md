# Decision テンプレート

Decision memory の品質を安定させるため、出力フォーマットを固定します。

## 必須セクション

すべての decision は次の見出しを含みます。

- `Summary:`
- `Why:`
- `Alternatives:`
- `Impact:`
- `Evidence:`

## フォーマット規則

- Summary: 1〜2 行
- Why / Alternatives / Impact: 各 1〜3 箇条
- Evidence: 可能なら `commit_sha` / `raw_event_id` を含める

## 強制方法

- LLM 抽出プロンプトで構造化出力を要求
- サーバー側で不足セクションを補完
- 情報不足時も見出しは必ず保持

## 例

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
