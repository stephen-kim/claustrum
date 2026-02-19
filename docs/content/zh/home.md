# 主页

Claustrum 是面向 AI 团队的共享记忆层。  
它可以在多个仓库、多个工具、多个成员之间保持上下文连续。

## 你可以做什么

- 保存与检索结构化记忆（`decision`、`constraint`、`active_work`、`activity`）
- 安全运行 MCP（`stdout` 只输出 JSON-RPC）
- 集成 GitHub 权限与 OIDC 访问控制
- 通过审计日志、时间线、保留策略进行治理
- 使用 Context Bundle / Global Rules / Persona / Debug 提升上下文质量

## 建议先看

- [安装](installation)
- [环境变量](environment-variables)
- [认证策略](authentication-strategy)
- [运维指南](operations)
- [API 参考](api-reference)

## 一行 MCP 配置助手

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -o ./claustrum-mcp-config-helper.js && node ./claustrum-mcp-config-helper.js
```

Windows PowerShell:

```powershell
iwr https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -OutFile .\claustrum-mcp-config-helper.js; node .\claustrum-mcp-config-helper.js
```

## 组件

- `memory-core`: REST API + Postgres + 策略引擎
- `mcp-adapter`: 调用 memory-core 的 MCP stdio 桥接器
- `admin-ui`: 工作区/权限/集成/审计控制台
