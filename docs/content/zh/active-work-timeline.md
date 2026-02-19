# Active Work 时间线

Active Work 的关键状态变化会记录为不可变事件。

## 事件存储

表：`active_work_events`

事件类型：

- `created`
- `updated`
- `stale_marked`
- `stale_cleared`
- `confirmed`
- `closed`
- `reopened`

事件可包含：

- score/evidence 细节
- 变更前后状态
- 可选 `correlation_id`

## API

- `GET /v1/projects/:key/active-work`
- `GET /v1/projects/:key/active-work/events`
- `POST /v1/active-work/:id/confirm`
- `POST /v1/active-work/:id/close`
- `POST /v1/active-work/:id/reopen`

## 管理后台

在 Context Debug 中可以查看：

- 当前 active work 列表
- stale/closed 状态
- 事件时间线（含 JSON 详情）
- 手动操作（maintainer+）

手动操作会写入审计：

- `active_work.manual_confirm`
- `active_work.manual_close`
- `active_work.manual_reopen`

最后更新: 2026-02-19
