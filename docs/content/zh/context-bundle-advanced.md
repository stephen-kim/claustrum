# 上下文包（高级）

本页用于说明如何借助 debug bundle 做上下文质量调优。

## Global Routing 诊断字段

`global.routing` 里可查看：

- `mode`
- `q_used`
- `selected_rule_ids`
- `dropped_rule_ids`
- `score_breakdown`（仅 debug）

## 调试流程

1. 打开 Admin UI 的 Context Debug
2. 输入 query / subpath（可选）
3. 加载 debug bundle
4. 对比以下两部分：

- `retrieval.results[*].score_breakdown`
- `global.routing.score_breakdown`

## 常见调优方法

- 关键规则被过滤：下调 `min_score` 或上调 `top_k`
- 噪声规则太多：上调 `min_score`、优化 tags、下调 `top_k`
- 预算紧张：减少 pinned 规则，使用 summary 压缩

## 注意事项

- bundle 不返回 raw 原文
- routing debug 仅用于解释，不会削弱权限控制

最后更新: 2026-02-19
