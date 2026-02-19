# GitHub 权限模型

Claustrum 的项目权限以 GitHub 为默认权威来源。

## 总体结构

- 每个 workspace 连接自己的 GitHub App installation
- 仓库元数据同步到 workspace 缓存
- 项目角色由 GitHub 权限映射得到

## Repo -> Project 规则

- 默认项目键：`github:owner/repo`
- shared 模式：按 repo 级 project 使用
- split 模式：可按策略扩展为 `repo#subpath`

## 权限计算

```text
final_perm = max(direct_collaborator_perm, team_derived_perm)
```

优先级：

```text
admin > maintain > write > triage > read
```

## Team 参与计算

会综合以下关系：

- repo -> teams
- team -> members
- member -> Claustrum user link

最终再做 `GitHub permission -> Claustrum role` 映射。

## Webhook 驱动部分重算

- `installation_repositories`: 仅重算变更 repo
- `team` / `membership`: 仅重算受影响 repo
- `repository` rename: 刷新元数据
- `team_add` / `team_remove`: 失效相关缓存后重算

## 缓存策略

- `github_repo_teams_cache`
- `github_team_members_cache`
- `github_permission_cache`

规则：
- 常规读取走 TTL
- 事件触发按影响范围失效
- 重算时覆盖权限缓存

## Sync Mode

| 模式 | 行为 |
| --- | --- |
| `add_only` | 只增/升，不删旧授权 |
| `add_and_remove` | 按 GitHub 当前状态增删改（带保护规则） |

## 运维检查清单

1. installation 已连接
2. repo sync / link 正常
3. user link 存在
4. permission preview 正常
5. webhook 与审计无异常
