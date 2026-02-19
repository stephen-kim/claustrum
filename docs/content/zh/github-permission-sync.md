# GitHub 权限同步

把 GitHub 的实际权限同步到 Claustrum 的项目角色。

## 流程

1. 连接 GitHub App installation
2. 执行 repo sync
3. 配置 `github_user_links`
4. 执行 permission sync（先 dry-run）

## 同步模式

### `add_only`（默认）
- 仅新增和升权
- 不删除、不降权

### `add_and_remove`
- 新增/更新/删除都执行
- 无权限用户会移除
- owner 保护规则仍生效

## 默认 role mapping

```json
{
  "admin": "maintainer",
  "maintain": "maintainer",
  "write": "writer",
  "triage": "reader",
  "read": "reader"
}
```

## unmatched user 处理

如果 GitHub 用户没有对应 user link：

- 计入 `skipped_unmatched`
- 在 preview 中显示 unmatched
- 不修改 Claustrum 角色

## 关键 API

- `GET /v1/workspaces/:key/github/user-links`
- `POST /v1/workspaces/:key/github/user-links`
- `DELETE /v1/workspaces/:key/github/user-links/:userId`
- `POST /v1/workspaces/:key/github/sync-permissions`
- `GET /v1/workspaces/:key/github/permission-status`
- `GET /v1/workspaces/:key/github/permission-preview`
- `GET /v1/workspaces/:key/github/cache-status`
