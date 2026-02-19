# 运维指南

## 默认检索模型

- 默认 `recall` 只查 `memories`。
- raw 原文数据与默认检索链路分离。
- raw 搜索只返回 snippet，不返回整段原文。

## Raw Import 流程

1. `POST /v1/imports`
2. `POST /v1/imports/:id/parse`
3. `POST /v1/imports/:id/extract`
4. `POST /v1/imports/:id/commit`

数据路径：

- `imports` → `raw_sessions/raw_messages` → `staged_memories` → `memories`

## 项目解析规则

默认优先级：

1. `github_remote`
2. `repo_root_slug`
3. `manual`

可在 workspace 设置：

- `resolution_order`
- `auto_create_project`
- key prefix
- `project_mappings`

## 自动切换策略

`ensureContext()` 会在 `remember`、`recall`、`search_raw` 前执行。

- `auto_switch_repo=true`（默认）
- `auto_switch_subproject=false`（默认）
- `pin_mode=true` 时不自动切换

## CI 事件接入

- Endpoint: `POST /v1/ci-events`
- 事件：`ci.success`、`ci.failure`

## 常用命令

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm test:workspace
```
