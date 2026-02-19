# 全局规则

Global Rules 用于管理团队级规则（workspace）和个人规则（user）。

## 作用域

- `workspace`: 团队共享规则
- `user`: 用户个人规则

## 设计原则

- 不做“最多 5 条”这类硬限制。
- 采用 token budget + score 动态选择。
- `pinned=true` 与 `severity=high` 永远优先。
- 规则过多时使用 summary 兜底。

## 核心字段

- `title`, `content`
- `category`: `policy | security | style | process | other`
- `priority`: `1..5`
- `severity`: `low | medium | high`
- `pinned`, `enabled`

## API

- `GET /v1/global-rules?workspace_key=...&scope=workspace|user&user_id?`
- `POST /v1/global-rules`
- `PUT /v1/global-rules/:id`
- `DELETE /v1/global-rules/:id`
- `POST /v1/global-rules/summarize`

### Summarize 模式

- `preview`: 仅返回摘要文本
- `replace`: 写入 `global_rule_summaries` 用于 bundle 压缩

## 软性阈值

- `global_rules_recommend_max`（默认 5）
- `global_rules_warn_threshold`（默认 10）

行为:
- 超过推荐值: info 提示
- 达到警告阈值: warn 提示

最后更新: 2026-02-19
