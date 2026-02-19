# Linear 集成

## 目标

将 Linear 作为 MCP 流程中的外部 issue 上下文来源。

- 搜索相关 issue
- 读取 issue 详情
- 在 memory-first 的基础上补充上下文

## 你需要准备

- Linear API key（Personal API key）
- 可选：自定义 `api_url`（默认 `https://api.linear.app/graphql`）
- `workspace_key`（例：`personal`）

## ENV（回退）

- `MEMORY_CORE_LINEAR_API_KEY`
- `MEMORY_CORE_LINEAR_API_URL`

## 配置步骤

1. 生成 Linear API key
2. 在 Admin UI（Integrations -> Linear）保存
   - `enabled=true`
   - `api_key`
   - `api_url`（可选）
3. 可选：通过 API 保存
4. 用 `/v1/linear/search`、`/v1/linear/read` 验证
5. 用 MCP 工具验证
   - `linear_search`
   - `linear_read`

## API 端点

- `GET /v1/linear/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/linear/read?workspace_key=<ws>&issue_key=<ENG-123>&max_chars=4000`

## 权限与审计

- read/search：workspace member+
- 审计事件：
  - `linear.search`
  - `linear.read`

## ENV 与 Admin UI 优先级

- 默认：Admin UI（DB）优先
- `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=linear` 时强制 ENV

## 故障排查

- `Integration not configured`：检查 `api_key` 与 `enabled=true`
- search 正常但 read 失败：检查 issue key 与 token 权限
