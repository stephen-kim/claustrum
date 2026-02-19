# Decision 模板

为保证检索质量稳定，decision 抽取采用固定结构。

## 必填分段

每条 decision 必须包含：

- `Summary:`
- `Why:`
- `Alternatives:`
- `Impact:`
- `Evidence:`

## 格式规则

- Summary: 1-2 行
- Why / Alternatives / Impact: 各 1-3 条 bullet
- Evidence: 尽量包含 `commit_sha` / `raw_event_id`

## 强制策略

- LLM 提示词要求结构化输出
- 服务端会补齐缺失分段
- 即使信息不足，也保留完整标题结构

## 示例

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
