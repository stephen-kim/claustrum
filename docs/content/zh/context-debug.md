# 上下文调试

Context Debug 用于解释“为什么当前 bundle 是这个结果”。

## 可检查内容

- 当前 persona 与推荐 persona
- 推荐原因与置信度
- global rule routing 选择结果
- active work candidates 及打分拆解
- retrieval 打分（FTS/vector + boosts）
- 各分段 token budget 占用
- active work 策略（`stale_days`, `auto_close`）

## 获取 debug bundle

- `GET /v1/context/bundle?...&mode=debug`

关键字段：
- `persona_applied`
- `persona_recommended`
- `weight_adjustments`
- `active_work_candidates`
- `active_work_policy`
- `token_budget`

## 手动覆盖

Admin UI 可执行：

- 应用推荐 persona
- confirm/pin active work
- close/reopen active work

这些操作保持显式触发，确保自动化可解释。

最后更新: 2026-02-19
