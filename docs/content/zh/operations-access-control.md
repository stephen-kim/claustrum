# 运维访问控制

这是一份面向运维/管理员的落地手册，用于稳定上线 workspace 权限控制。

## 新 Workspace 上线流程

1. 创建 workspace
2. 连接 GitHub App
3. 执行 repo sync
4. 确认 repo -> project 链接
5. 先 dry-run，再 apply permission sync
6. 配置 OIDC 并验证登录 gate
7. 按需配置 group mapping
8. 检查审计日志是否完整

## GitHub 配置流程

### Install / Sync

1. 打开 workspace 的 GitHub Integration
2. 连接 installation
3. 点击 `Sync repos`
4. 确认 linked projects

### Permission Sync

1. 先跑 dry-run
2. 查看 unmatched users
3. 建立 `Claustrum user <-> GitHub login` 链接
4. 执行 apply sync

## OIDC 配置流程

1. 配置 provider metadata
2. 验证 issuer / client
3. 确认身份按 `(issuer, subject)` 创建
4. 使用稳定 group id 配置 mapping
5. 验证受保护 API 的 OIDC gate 生效

## 故障排查顺序（推荐）

1. OIDC gate 是否通过
2. workspace membership 是否存在
3. GitHub installation 是否健康
4. repo sync / project link 是否正确
5. GitHub user link 是否存在
6. permission preview 的 direct/team max 是否符合预期
7. webhook delivery 状态是否异常
8. recompute / apply 的审计日志是否异常

## 建议监控的审计事件

- `github.webhook.received`
- `github.webhook.signature_failed`
- `github.repos.synced`
- `github.permissions.computed`
- `github.permissions.applied`
- `github.permissions.recomputed`
- `github.user_link.created`
- `github.user_link.deleted`

## 运维建议

- 初期默认使用 `add_only`
- 审计稳定后再启用 `add_and_remove`
- owner 保护规则保持开启
- 优先使用 partial recompute，避免全量重算

最后更新: 2026-02-19
