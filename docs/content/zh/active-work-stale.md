# Active Work 过期与自动关闭

Active Work 基于近期信号推断，并会周期性重算。

## 关键字段

`active_work` 包含：

- `stale` / `stale_reason`
- `last_evidence_at`
- `status`（`inferred` | `confirmed` | `closed`）
- `closed_at`

## 工作区策略

在 Workspace Settings 中配置：

- `active_work_stale_days`（默认: `14`）
- `active_work_auto_close_enabled`（默认: `false`）
- `active_work_auto_close_days`（默认: `45`）

## 规则

- `last_evidence_at` 超过 `stale_days` 时，标记为 stale。
- 若开启 auto-close，且 stale 持续超过 `auto_close_days`，inferred 项会自动关闭。
- confirmed 项默认不参与 auto-close。

## 触发方式

- 手动：`POST /v1/projects/:key/recompute-active-work`
- 定时：夜间重算任务

最后更新: 2026-02-19
