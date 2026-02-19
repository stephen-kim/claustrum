# GitHub Webhook 自动同步

该功能用于接收 GitHub 事件，并只对受影响范围触发同步/重算。

## 处理机制

- 入口：`POST /v1/webhooks/github`
- 校验：`X-Hub-Signature-256`
- 幂等：按 `delivery_id` 去重
- 处理：先入队，快速 200，worker 异步执行

## 主要事件

- `installation_repositories`
  - 执行 repo sync
  - 对受影响 repo 重算权限
- `team` / `membership`
  - 按 team mapping 应用角色
- `repository` rename
  - 更新 repo link 元数据

## 安全策略

- secret 来源：`GITHUB_APP_WEBHOOK_SECRET`
- 签名不合法：入队前拒绝
- 重试上限：3 次

## Admin UI

**Workspace -> Integrations -> GitHub**

- webhook 开关
- sync mode
- delivery 状态列表

## 故障排查

1. 检查 webhook secret 是否一致
2. 检查 installation 是否正确连接
3. 检查 team mapping 与 user links 是否完整

最后更新: 2026-02-19
