# ペルソナ

Persona は、ユーザーごとに「どの文脈を強く出すか」を調整する機能です。
権限やロールを変える機能ではありません。

## Persona モード

- `neutral`（既定）: バランス型 + active work を少し優先
- `author`: 実装寄り（active work / recent activity を強化）
- `reviewer`: レビュー寄り（constraint / decision を強化）
- `architect`: 設計寄り（decision / constraint を強化）

## 推薦（ヒントのみ）

- `GET /v1/context/persona-recommendation?workspace_key=...&project_key=...&q=...`
- 推薦結果はあくまで提案です。
- 自動切り替えは行いません。

## 適用フロー

1. Context Debug を開く
2. 現在の質問で推薦を実行
3. 必要なら `Apply Recommended Persona` を押す

適用操作は `user.persona.changed` として監査されます。

最終更新: 2026-02-19
