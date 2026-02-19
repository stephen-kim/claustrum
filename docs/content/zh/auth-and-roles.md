# 认证与角色

Claustrum 先用 API Key 识别用户身份，再按 workspace / project 角色做权限校验。

## 角色模型

### Workspace 角色
- `owner`
- `admin`
- `member`

### Project 角色
- `owner`
- `maintainer`
- `writer`
- `reader`

说明:
- workspace 的 `owner/admin` 可在同一 workspace 内进行 project 权限覆盖（用于运维兜底）。

## 权限速查

| 操作 | 最低角色 |
| --- | --- |
| 查看 workspace 成员 | workspace `member` |
| 管理 workspace 成员 | workspace `admin` |
| 创建 / 列出项目 | workspace `member` |
| 查看项目成员 | project `reader` |
| 管理项目成员 | project `maintainer` |
| 创建 memory | project `writer` |
| 读取 memories | project `reader` |
| 确认 / 拒绝 decision | project `maintainer` |
| Raw 搜索 / Raw 查看 | `raw_access_min_role`（默认 `writer`） |

## Raw 访问策略

- `/v1/raw/search` 和 `/v1/raw/messages/:id` 的最低角色由 `workspace_settings.raw_access_min_role` 控制。
- 默认值为 `writer`。
- 所有 raw 访问都会写入审计（`raw.search`, `raw.view`）。

## 审计日志

以下关键操作会写入 `audit_logs`：
- `memory.create`
- `memory.update`
- `memory.delete`
- `decision.confirm`
- `decision.reject`
- 成员管理 / API Key 管理

最后更新: 2026-02-19
