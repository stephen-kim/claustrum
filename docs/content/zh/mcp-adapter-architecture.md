# MCP Adapter 架构

Claustrum 的 MCP adapter 在本地以轻量进程运行，  
真正的上下文逻辑和数据存储在远端 Claustrum 服务。

## 运行时目录结构

```text
~/.claustrum/
  bin/claustrum-mcp
  adapter/
    current/
    versions/vX.Y.Z/
  logs/
    adapter.log
    error.log
  state.json
  update.lock
```

## 请求链路

1. MCP 客户端通过 stdio 发送 JSON-RPC
2. 本地 adapter 从 stdin 读取 MCP 帧
3. 转发到 `POST ${CLAUSTRUM_BASE_URL}/v1/mcp`
4. 远端响应再写回 stdout（JSON-RPC）
5. 日志仅写 stderr 或文件

## stdout 安全与日志策略

- `stdout`: 只允许 JSON-RPC
- `stderr`: 运行日志和错误

日志轮转：
- `adapter.log` 最大 5MB
- `error.log` 最大 5MB
- `~/.claustrum/logs` 总量上限 10MB

API key、Bearer token、私钥块等敏感信息在落日志前会被掩码处理。

## 自动更新流程

- 用 ETag 检查 GitHub Releases
- 用 `update.lock` 防止并发更新竞争
- 用 `SHA256SUMS` 校验下载内容
- 原子切换 `adapter/current` symlink
- 更新失败时回退保留旧版本

## 安全默认项

- 生产环境应使用 HTTPS 的 `CLAUSTRUM_BASE_URL`
- 不关闭 TLS 证书校验
- 更新源固定为允许的仓库

## 故障排查

- 上游不可达：检查 `CLAUSTRUM_BASE_URL`、网络、TLS 证书链
- 未更新：检查 `~/.claustrum/state.json`、`update.lock`、`~/.claustrum/logs/error.log`
- MCP 协议异常：确认 stdout 没有混入非 JSON-RPC 输出
