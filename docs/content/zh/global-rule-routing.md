# 全局规则路由

如果每次都注入全部 Global Rules，会显著增加上下文噪声。
Claustrum 会根据问题与上下文动态选择规则。

## 始终包含的规则

- `pinned=true`
- `severity=high`

其余规则按 score 选择。

## Routing 模式

- `semantic`
- `keyword`
- `hybrid`（默认）

关键设置：
- `global_rules_routing_enabled`（默认 `true`）
- `global_rules_routing_mode`（默认 `hybrid`）
- `global_rules_routing_top_k`（默认 `5`）
- `global_rules_routing_min_score`（默认 `0.2`）

## 评分公式（概念）

`score = semantic_similarity + keyword_overlap + priority_weight + recency_weight - length_penalty`

## Query 来源顺序

1. 接口传入的显式 `q`
2. 若无 `q`，由 summary / active work / recent activity / subpath 生成 pseudo-query

## 与 Token Budget 的关系

- 先按 score 排序
- 再按预算截断
- 预算不够时使用 summary fallback

## 在 Admin UI 查看

- Workspace -> Global Rules（参数配置）
- Project -> Context Debug（入选/剔除及打分）

## 调参建议

- `top_k` 建议在 `3~8`
- 噪声高时提高 `min_score`
- 补充 tags 可提升 keyword routing 效果

最后更新: 2026-02-19
