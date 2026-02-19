# Notion 集成

## 目标

把 Notion 作为 AI 工作流的外部上下文来源。

- 会话中搜索/阅读文档
- 可选：在 merge 时做写回同步

## 你需要准备

- Notion integration token
- 已把目标页面/数据库共享给该 integration
- `workspace_key`（例：`personal`）

## ENV（回退）

- `MEMORY_CORE_NOTION_TOKEN`
- `MEMORY_CORE_NOTION_DEFAULT_PARENT_PAGE_ID`
- `MEMORY_CORE_NOTION_WRITE_ENABLED`

## 配置步骤

1. 创建内部 integration 并获取 token
2. 在 Admin UI（Integrations -> Notion）保存配置
   - `enabled=true`
   - `token`
   - `default_parent_page_id`（可选）
   - `write_enabled`（需要写入时开启）
3. 可选：通过 API 保存
4. 用 `/v1/notion/search`、`/v1/notion/read` 验证
5. 用 MCP 工具验证
   - `notion_search`
   - `notion_read`
   - `notion_context`

## API 端点

- `GET /v1/notion/search?workspace_key=<ws>&q=<query>&limit=10`
- `GET /v1/notion/read?workspace_key=<ws>&page_id=<id-or-url>&max_chars=4000`
- `POST /v1/notion/write`（仅 admin）

## 权限与审计

- read/search：workspace member+
- write：workspace admin + `write_enabled=true`
- 审计事件：
  - `notion.search`
  - `notion.read`
  - `notion.write`

## 推荐做法

写回建议走 CI 的 merge 流程，而不是本地 git hook：

- 运行环境更一致
- secrets 更集中
- 降低开发者本地差异导致的问题

## ENV 与 Admin UI 优先级

- 默认：Admin UI（DB）优先
- `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=notion` 时强制 ENV

## 故障排查

- search/read 报错：检查 token 与页面共享权限
- write 失败：检查 admin 权限与 `write_enabled`
- merge 写回未触发：检查 `write_on_merge` 与流水线事件配置
