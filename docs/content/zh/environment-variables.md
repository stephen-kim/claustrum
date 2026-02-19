# 环境变量（完整参考）

本页是 `.env.example` 的补充说明。  
`.env.example` 保持最小可用，这里提供按场景整理的完整参考。

## 最小必需项

- `DATABASE_URL`
- `MEMORY_CORE_API_KEY`
- `MEMORY_CORE_URL`
- `NEXT_PUBLIC_MEMORY_CORE_URL`
- 仅 localdb 需要：`POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD`

## 关键规则

- `memory-core` 连接数据库只看 **`DATABASE_URL`**。
- `POSTGRES_*` 仅用于 localdb 初始化。
- Notion/Jira/Confluence/Linear/Slack 等集成配置可放 DB（Admin UI）或 ENV。
- `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS` 控制优先级来源。

## 主要分类

- Core runtime: `MEMORY_CORE_HOST`, `MEMORY_CORE_PORT`, `MEMORY_CORE_LOG_LEVEL`
- Bootstrap/Auth/Security: `MEMORY_CORE_ALLOW_BOOTSTRAP_ADMIN`, `MEMORY_CORE_SECRET` 等
- GitHub App: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`
- MCP Adapter: `MEMORY_CORE_URL`, `MEMORY_CORE_API_KEY`, `MEMORY_CORE_WORKSPACE_KEY`
- Admin UI: `NEXT_PUBLIC_MEMORY_CORE_URL`, `ADMIN_UI_PORT`
- Compose: `COMPOSE_PROFILES`, `MEMORY_CORE_IMAGE`, `MCP_ADAPTER_IMAGE`, `ADMIN_UI_IMAGE`

## Integration lock 行为

`MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS`:

- `all`: 所有 provider 强制走 ENV
- `none`: 忽略 ENV，使用 DB 配置
- CSV: 仅指定 provider 强制走 ENV

示例：
- `notion,jira,confluence,linear,slack,audit_reasoner`

## 运维建议

- `.env.example` 保持精简
- `.env` 只保留实际使用项
- 不要把密钥提交到 Git
- CI 使用 GitHub Secrets
