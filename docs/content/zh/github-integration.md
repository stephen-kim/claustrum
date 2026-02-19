# GitHub Integration（Workspace 级）

## 范围

本页聚焦 GitHub 集成基础能力：

- 将 GitHub App installation 连接到 workspace
- 同步仓库清单到 Claustrum
- 为项目关联和权限同步准备仓库元数据

进阶内容请看：
- [GitHub Auto Projects](github-auto-projects)
- [GitHub Permission Sync](github-permission-sync)
- [GitHub Webhooks](github-webhooks)

## Workspace 级模型

每个 workspace 最多对应 **0 或 1** 个 GitHub App installation。

- `github_installations`：安装信息
- `github_repo_links`：同步仓库缓存

## 环境变量

必需：
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`

可选：
- `GITHUB_APP_WEBHOOK_SECRET`（启用 webhook 时必需）
- `GITHUB_APP_NAME`, `GITHUB_APP_URL`
- `MEMORY_CORE_GITHUB_STATE_SECRET`

`GITHUB_APP_PRIVATE_KEY` 支持：
- 原始 PEM
- 带 `\n` 的转义 PEM
- base64 编码 PEM

## 安装流程

1. Admin UI 请求 install URL
2. 跳转 GitHub 安装页
3. GitHub 回调 `installation_id + state`
4. memory-core 校验 state/管理员权限并 upsert `github_installations`

## 主要 API

- `GET /v1/workspaces/:key/github/install-url`
  - 权限：workspace admin+

- `GET /v1/auth/github/callback?installation_id=...&state=...`
  - 校验签名 state
  - upsert `github_installations`
  - audit: `github.installation.connected`

- `POST /v1/workspaces/:key/github/sync-repos`
  - 权限：workspace admin+
  - 生成短时 installation token（不入库）
  - upsert `github_repo_links`
  - audit: `github.repos.synced`

- `GET /v1/workspaces/:key/github/repos`
  - 权限：workspace member+
  - 返回 active 仓库缓存

- `GET /v1/workspaces/:key/github/installation`
  - 权限：workspace member+
  - 返回连接状态

## 安全要点

- installation token 短生命周期且不持久化
- callback state 必须签名且有时效
- callback 会再次校验 actor 是否仍为 admin/owner
- private key 仅服务器端使用
