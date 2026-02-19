# コンテキスト予算

Claustrum は固定件数カットではなく、token budget 分割で context を構成します。

## Workspace 設定

- `bundle_token_budget_total`（既定: `3000`）
- `bundle_budget_global_workspace_pct`（既定: `0.15`）
- `bundle_budget_global_user_pct`（既定: `0.10`）
- `bundle_budget_project_pct`（既定: `0.45`）
- `bundle_budget_retrieval_pct`（既定: `0.30`）

## 割当イメージ

総予算を `B` とすると:

- workspace global: `B * workspace_pct`
- user global: `B * user_pct`
- retrieval: `B * retrieval_pct`
- project snapshot: 残りをセクション単位で配分

## Global Rules の選定順

1. `pinned=true`
2. `severity=high`
3. 残りを選択モードで充填（`score` / `recent` / `priority_only`）

ルール数が多い場合は summary を併用します。

## Debug で見えるもの

`GET /v1/context/bundle?...&mode=debug`

- セクション別 budget
- 選択/除外件数
- 選択モード
- retrieval score breakdown

## チューニング目安

- `global_workspace_pct + global_user_pct` は `0.20 ~ 0.35` 付近
- query 重視なら retrieval は `>= 0.25`
- ルール増加時は hard limit ではなく summary 強化

最終更新: 2026-02-19
