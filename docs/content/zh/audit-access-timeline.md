# 访问权限变更时间线

定义 Claustrum 如何记录并展示访问权限变更。

## 目标

让管理员能快速回答：
- 谁改了权限
- 改了什么（新增/变更/删除）
- 为什么改（manual/github/oidc/system）
- 哪个 job 或 webhook 触发

## Action Key 分类

Workspace:
- `access.workspace_member.added`
- `access.workspace_member.role_changed`
- `access.workspace_member.removed`

Project:
- `access.project_member.added`
- `access.project_member.role_changed`
- `access.project_member.removed`

## 标准 `params`

最少包含：
- `source`
- `target_user_id`
- `old_role`
- `new_role`
- `workspace_key`
- `project_key`（project 事件）
- `correlation_id`（推荐）
- `evidence`（可选）

## Correlation ID 用法

用于聚合同一批次变更。

例如：
- GitHub webhook delivery id
- permission sync job id
- OIDC 同步事务 id

## API

- `GET /v1/audit/access-timeline`

常用参数：
- `workspace_key`（必填）
- `project_key`
- `user_id`
- `source`
- `action`（`add|change|remove`）
- `from`, `to`
- `limit`, `cursor`

## Admin UI 过滤

- project
- target user
- source
- action
- date range
- cursor pagination

最后更新: 2026-02-19
