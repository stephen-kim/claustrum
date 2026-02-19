# GitHub 权限计算

本文说明 Claustrum 如何从 GitHub 计算“最终权限”。

## 计算规则

最终权限按以下规则计算：

```text
final_permission = max(direct collaborator permission, team-derived permissions)
```

优先级：

```text
admin > maintain > write > triage > read
```

## 使用的数据来源

每个已链接 repo 会读取：

1. direct collaborators
2. repo teams
3. team members

先把 team 权限展开到用户级，再与 direct 权限按 max 合并。

## 缓存策略

设置项：
- `github_cache_ttl_seconds`（默认 900）

缓存表：
- `github_repo_teams_cache`
- `github_team_members_cache`
- `github_permission_cache`

行为：
- TTL 内命中则复用
- 过期/缺失则重新调用 GitHub API
- 同步采用有限重试的 best-effort

## 同步模式

### `add_only`
- 只补充缺失成员
- 按需升级角色
- 不删除、不降级

### `add_and_remove`
- 按 GitHub 结果做增改删
- 保留 owner/admin 保护规则
- 仅对计算成功的 repo 执行删除

## 相关 API

- `POST /v1/workspaces/:key/github/sync-permissions`
- `GET /v1/workspaces/:key/github/permission-preview?repo=owner/repo`
- `GET /v1/workspaces/:key/github/cache-status`
