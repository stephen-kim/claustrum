# 上下文包 API

Context Bundle 用来统一上下文格式，让 Codex / Claude / Cursor 等客户端拿到一致的数据结构。

## Endpoint

- `GET /v1/context/bundle`

## Query 参数

- `workspace_key`（必填）
- `project_key`（必填）
- `q`（可选）
- `current_subpath`（可选）
- `mode=default|debug`（可选）
- `budget`（可选）

## 返回内容

- `project`: 项目信息
- `snapshot`: summary / decisions / constraints / active_work / recent_activity
- `retrieval`: 检索结果
- `global`: workspace/user 全局规则
- `debug`（仅 `mode=debug`）: 打分拆解、boost、预算分配

## 关键规则

- 返回的是精炼后的上下文文本。
- 不直接返回 raw 原文。
- raw 只通过 `evidence_ref` 引用。

## 在 MCP 中的使用

`mcp-adapter` 可通过 `context_bundle()` 在 `recall` / `remember` 前获取标准上下文。

最后更新: 2026-02-19
