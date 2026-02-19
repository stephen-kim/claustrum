# 上下文预算

Claustrum 采用 token 预算分配，而不是固定条数截断。

## Workspace 设置

- `bundle_token_budget_total`（默认 `3000`）
- `bundle_budget_global_workspace_pct`（默认 `0.15`）
- `bundle_budget_global_user_pct`（默认 `0.10`）
- `bundle_budget_project_pct`（默认 `0.45`）
- `bundle_budget_retrieval_pct`（默认 `0.30`）

## 分配方式

总预算 `B`：

- workspace global: `B * workspace_pct`
- user global: `B * user_pct`
- retrieval: `B * retrieval_pct`
- project snapshot: 按分段上限分配

## Global Rules 选择顺序

1. `pinned=true`
2. `severity=high`
3. 剩余按模式补齐（`score` / `recent` / `priority_only`）

规则过多时用 summary 压缩。

## Debug 可见信息

`GET /v1/context/bundle?...&mode=debug`

- 各分段预算
- 选中/省略数量
- 选择模式
- retrieval score breakdown

## 调参建议

- `global_workspace_pct + global_user_pct` 建议在 `0.20 ~ 0.35`
- retrieval 建议 `>= 0.25`
- 规则变多时优先启用 summary，而不是硬限制

最后更新: 2026-02-19
