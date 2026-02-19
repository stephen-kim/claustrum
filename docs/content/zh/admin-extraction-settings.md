# 提取设置（Admin）

此页面用于控制 raw Git 活动如何转成 `activity` 与 `decision` memory。

说明：locale 只影响 outbound 消息，不影响提取逻辑。

## 配置入口

Admin Console：

- `Project Resolution Settings` -> Extraction Pipeline
- `Decision Keyword Policies`
- `Decisions`

## 提取流水线设置

- `enable_activity_auto_log`
  - 每次 commit/merge 生成 `activity` memory
- `enable_decision_extraction`
  - 启用异步 LLM 决策提取
- `decision_extraction_mode`
  - `llm_only`: 按时间处理
  - `hybrid_priority`: 优先处理高分事件
- `decision_default_status`
  - LLM 生成 decision 的默认状态
- `decision_auto_confirm_enabled`
  - 是否启用自动确认
- `decision_auto_confirm_min_confidence`
  - 自动确认阈值
- `decision_batch_size`
  - 每轮最多处理事件数
- `decision_backfill_days`
  - 回看窗口天数

## 关键词策略（仅用于调度优先级）

每条策略包含：

- 正/负关键词
- 正/负文件路径模式
- 正/负权重
- enabled

关键点：关键词策略**不会**直接决定是否为 decision。  
它只影响 LLM 任务的执行优先级。

## Decisions 面板

- 过滤：project / status / confidence range
- 证据展示：`raw_event_id`, `commit_sha`
- 操作：`Confirm`, `Reject`

## 推荐默认值

- `enable_activity_auto_log = true`
- `enable_decision_extraction = true`
- `decision_extraction_mode = llm_only`
- `decision_default_status = draft`
- `decision_auto_confirm_enabled = false`
- `decision_auto_confirm_min_confidence = 0.90`
- `decision_batch_size = 25`
- `decision_backfill_days = 30`

最后更新: 2026-02-19
