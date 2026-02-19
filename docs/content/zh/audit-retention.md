# 审计留存策略

按 workspace 配置审计与原始数据的保留策略。

## 配置项

- `retention_policy_enabled`（默认: `false`）
- `audit_retention_days`（默认: `365`）
- `raw_retention_days`（默认: `90`）
- `retention_mode`（`archive` | `hard_delete`，默认: `archive`）

## 数据处理

### raw_events
- 删除超过 `raw_retention_days` 的数据

### audit_logs
- `archive`（推荐）：迁移到 `audit_logs_archive` 后再删除原数据
- `hard_delete`：直接删除

## 任务执行

- 每日 retention job
- 仅处理 `retention_policy_enabled=true` 的 workspace
- 每次执行写入 `audit.retention.run`

事件常见字段：
- `retention_mode`
- `audit_retention_days`
- `raw_retention_days`
- `archived_count`
- `deleted_count`
- `raw_deleted_count`

## 建议

- 初期优先 `archive`
- 企业环境建议审计保留 180-365 天
- `hard_delete` 仅在合规强要求时使用

最后更新: 2026-02-19
