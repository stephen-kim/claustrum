# Claustrum

[English README](README.md) | [한국어 README](README.ko.md) | [日本語 README](README.ja.md) | [Español README](README.es.md) | [中文 README](README.zh.md)

Claustrum 是一个面向 AI 系统的共享记忆层，可在项目、工具与团队之间统一上下文。


## 这个项目能做什么

- 在多台电脑与多名开发者之间共享记忆上下文。
- 让 MCP 工作流具备生产可用的安全性（`stdout` 干净、策略驱动）。
- 通过 Admin UI 管理工作区、项目、用户、权限与审计日志。
- 支持外部上下文来源（Notion、Jira、Confluence、Linear、Slack）。


## 为什么要做它

AI 开发中的上下文很容易碎片化：

- 每台机器的记忆状态不同
- 每位协作者看到的上下文不同
- 项目决策散落在提交、聊天和文档中

Claustrum 将这些分散信息变成团队可共享、可检索的记忆系统。


## 核心组件

- **Memory Core**: REST API + 策略 + Postgres 存储
- **MCP Adapter**: 通过 stdio 调用 Memory Core 的 MCP 桥接层
- **Admin UI**: 团队运营管理面板
- **Shared Package**: 共享 schema、类型与工具


## 文档策略（以 Pages 为主）

本 README 仅保留概要。详细安装、配置与运维文档发布在 GitHub Pages，源文件位于 `docs/content`。

- [Docs Site (GitHub Pages)](https://stephen-kim.github.io/claustrum/)


## 仓库结构

```text
apps/
  docs-site/
  memory-core/
  mcp-adapter/
  admin-ui/
packages/
  shared/
```


## Upstream

- Upstream (`upstream`): `https://github.com/Intina47/context-sync.git`
