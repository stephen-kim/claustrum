# 安全与 MCP I/O

## MCP stdio 规则

MCP server / adapter 必须严格遵守：

- `stdout`：只能输出 JSON-RPC 协议消息
- `stderr`：只能输出日志和错误

不要把启动 banner、调试文本、迁移日志写到 stdout。

## Raw 数据护栏

- `raw.search` 只返回 snippet
- 单条 raw 消息查看也只返回 snippet
- 必须强制 `max_chars`
- 默认不返回完整会话原文

## 访问控制

- 必须使用 API key 认证（`Authorization: Bearer <key>`）
- `raw.search` / `raw.view` 权限更严格：
  - 需要 admin 或项目成员权限
  - workspace 级 raw 搜索要求 workspace admin/owner

## 审计要求

以下事件必须记录并定期审查：

- `raw.search`
- `raw.view`

审计日志至少包含 actor、target、timestamp。

## 部署安全建议

- 外部数据库连接启用 TLS（如 `sslmode=require`）
- 定期轮换 API key
- 避免在 stderr 输出任何敏感信息
