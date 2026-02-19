# Atlassian Integration（Jira + Confluence）

## 目标

把 Jira 和 Confluence 作为 MCP 工作流的外部上下文来源。

- Jira：搜索/读取 issue 上下文
- Confluence：搜索/读取文档上下文
- 两者都以读取为主，并且纳入审计

## 你需要准备

- Atlassian Cloud 站点 URL（例：`https://your-org.atlassian.net`）
- Atlassian 账号邮箱
- Atlassian API token
- memory-core 中的 `workspace_key`（例：`personal`）

## ENV（回退）

Jira:
- `MEMORY_CORE_JIRA_BASE_URL`
- `MEMORY_CORE_JIRA_EMAIL`
- `MEMORY_CORE_JIRA_API_TOKEN`

Confluence:
- `MEMORY_CORE_CONFLUENCE_BASE_URL`
- `MEMORY_CORE_CONFLUENCE_EMAIL`
- `MEMORY_CORE_CONFLUENCE_API_TOKEN`

## 配置步骤

1. 生成 Atlassian API token
2. 在 Admin UI 中保存配置（Integrations）
   - `enabled=true`
   - `base_url`, `email`, `api_token`
3. 可选：通过 API 保存
4. 用 `/v1/jira/search`、`/v1/confluence/search` 验证
5. 用 MCP 工具验证
   - `jira_search`, `jira_read`
   - `confluence_search`, `confluence_read`

## API 端点

Jira:
- `GET /v1/jira/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/jira/read?workspace_key=<ws>&issue_key=<ABC-123>&max_chars=4000`

Confluence:
- `GET /v1/confluence/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/confluence/read?workspace_key=<ws>&page_id=<id-or-url>&max_chars=4000`

## 权限与审计

- read/search 需要 workspace member+
- 审计事件：
  - `jira.search`
  - `jira.read`
  - `confluence.search`
  - `confluence.read`

## ENV 与 Admin UI 优先级

- 默认：Admin UI（DB）优先
- `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=jira,confluence` 时强制 ENV

## 故障排查

- `Invalid API key`：检查 Authorization 头
- `Integration not configured`：检查 workspace 是否已保存配置
- search 正常但 read 失败：检查 Atlassian 侧权限
