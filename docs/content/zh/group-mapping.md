# 组映射

Group Mapping 用于把 IdP 组映射到 Claustrum 的 workspace/project 角色。

## 映射字段

- `provider_id`
- `claim_name`（例如 `groups`）
- `group_id`（稳定 ID）
- `group_display_name`（仅 UI 展示）
- `target_type`（`workspace` 或 `project`）
- `target_key`
- `role`
- `priority`
- `enabled`

## 目标角色

### Workspace
- `OWNER`
- `ADMIN`
- `MEMBER`

### Project
- `OWNER`
- `MAINTAINER`
- `WRITER`
- `READER`

## 同步模式

`workspace_settings.oidc_sync_mode`:

- `add_only`（默认）
  - 增加/更新映射授权
  - 保留未匹配授权
- `add_and_remove`
  - 也会移除未匹配成员
  - owner 保护规则仍生效

## 映射示例

1) Workspace Admin
- `group_id = 00gk9abc123xyz`
- `target_type = workspace`
- `target_key = personal`
- `role = ADMIN`

2) Project Writer
- `group_id = 00gk9devs123xyz`
- `target_type = project`
- `target_key = github:org/repo#apps/admin-ui`
- `role = WRITER`

## 运维建议

- 用稳定 group id，不用名称
- 先配置少量关键映射
- 通过 `priority` 管理冲突顺序

最后更新: 2026-02-19
