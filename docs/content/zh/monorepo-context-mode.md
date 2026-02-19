# Monorepo 上下文模式

Claustrum 支持在 workspace 级别选择 monorepo 的记忆隔离策略。

## 模式

### 1) `shared_repo`（默认）

- active `project_key` 保持 repo 级（`github:org/repo`）
- 检测到的 subpath 存入 `metadata.subpath`
- recall/search 可用 `current_subpath` 做排序加权
- 适合希望跨子项目共享记忆但又要降噪的团队

### 2) `split_on_demand`（推荐 split 默认）

- 仅拆分 `monorepo_subproject_policies` 中列出的 subpath
- 命中时 key 形如 `github:org/repo#apps/admin-ui`
- 未列出的 subpath 回退 repo 级
- 适合只隔离部分 apps/packages 的场景

### 3) `split_auto`（高级）

- 检测到 subpath 就可解析成 `repo#subpath`
- 若开启自动创建，可自动补齐缺失 subproject
- 更适合边界清晰、治理成熟的 monorepo

## Workspace 设置项

- `monorepo_context_mode`: `shared_repo` | `split_on_demand` | `split_auto`
- `monorepo_subpath_metadata_enabled`: shared 模式下保存 `metadata.subpath`
- `monorepo_subpath_boost_enabled`: shared 模式下按 subpath 加权
- `monorepo_subpath_boost_weight`: 加权倍数（默认 `1.5`）

## key 示例

- Shared: `github:acme/claustrum`
- Split: `github:acme/claustrum#apps/memory-core`

## 说明

- resolver fallback 顺序不变：`github_remote > repo_root_slug > manual`
- split 模式下若 subpath 检测失败，会回退到 repo key
- UI 配置入口：**Project Resolution Settings -> Monorepo Context**
