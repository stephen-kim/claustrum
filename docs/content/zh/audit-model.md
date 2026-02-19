# 审计模型

Claustrum 的审计系统以“可追踪 + 不可篡改”为核心。

## 核心原则

- append-only
- DB 层禁止 `UPDATE` / `DELETE`
- 使用 `correlation_id` 串联批量操作
- 导出行为本身也会审计

## append-only 保障

`audit_logs` 仅允许 `INSERT`，阻止更新与删除。

## 常用 action_key

- `access.workspace_member.*`
- `access.project_member.*`
- `audit.export`
- `audit.retention.run`

## Correlation ID

用于聚合同一批操作，例如：

- GitHub webhook delivery
- permission sync job
- OIDC 同步事务

## 审计导出

- `GET /v1/audit/export`
- 支持 `csv` / `json`
- 仅 workspace admin 可执行

最后更新: 2026-02-19
