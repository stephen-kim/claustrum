# GitHub 团队映射

## 目标

GitHub Team Mapping 用来把 GitHub 团队成员关系映射到 Claustrum 的 workspace/project 角色。

该能力由 webhook（`team`, `membership`）驱动，并受以下配置控制：

- `github_team_mapping_enabled`
- `github_webhook_sync_mode`（`add_only` / `add_and_remove`）

## 数据模型

`github_team_mappings` 关键字段：

- `workspace_id`
- `provider_installation_id`（可选）
- `github_team_id`, `github_team_slug`, `github_org_login`
- `target_type`（`workspace` / `project`）
- `target_key`
- `role`
- `priority`, `enabled`

## 同步模式行为

### add_only

- 补齐缺失成员
- 如果新角色更高则升级
- 不删除已有成员

### add_and_remove

- 按映射规则新增/更新成员
- 删除已不在团队范围内的链接成员
- 保留 owner/admin 保护规则

## 推荐角色映射

- Workspace target: `OWNER` / `ADMIN` / `MEMBER`
- Project target: `OWNER` / `MAINTAINER` / `WRITER` / `READER`

## 示例

### 示例 1：platform team -> project maintainer

- Team: `acme/platform-team` (`github_team_id=42`)
- Target: `project`
- Target key: `github:acme/platform`
- Role: `MAINTAINER`

结果：`platform-team` 的已链接用户在 `github:acme/platform` 上获得/保持 maintainer 权限。

### 示例 2：security team -> workspace admin

- Team: `acme/security` (`github_team_id=77`)
- Target: `workspace`
- Target key: `team-alpha`
- Role: `ADMIN`

结果：`security` 的已链接用户成为 `team-alpha` 的 workspace admin。

## Admin UI

位置：**Workspace -> Integrations -> GitHub -> GitHub Team Mappings**

可执行操作：
- 新建 mapping
- 启用/禁用
- 删除 mapping

输入项：
- org login、team slug、team id
- target type/key
- role
- priority
