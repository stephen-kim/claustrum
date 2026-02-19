# Monorepo 拆分策略

## 可选模式

`monorepo_context_mode` 支持 3 种模式：

1. `shared_repo`（默认）
2. `split_on_demand`
3. `split_auto`（高级）

## 模式对比

### `shared_repo`

- active project key 保持 repo 级（`github:owner/repo`）
- subpath 作为 metadata 用于排序/加权
- 运维成本最低

### `split_on_demand`

- 仅隔离明确列出的 subpath
- 规则来源：`monorepo_subproject_policies`
- 未列出的 subpath 继续走 repo 级
- 生产环境最推荐的 split 策略

### `split_auto`

- 在 guardrail 下自动创建/使用 `repo#subpath`
- 更激进、更省手工，但容易增加项目数量
- 除非团队明确需要自动隔离，否则建议关闭

## 为什么推荐 split_on_demand

- 可避免大型 monorepo 的项目数量失控
- 管理员可以明确控制边界
- 不需要隔离的区域仍能共享上下文

## 运营建议

1. 先从 `shared_repo` 开始
2. 出现明确隔离需求后切到 `split_on_demand`
3. 只为必要 subpath 添加 policy
4. 仅在可接受自动扩张时使用 `split_auto`

## Policy 表

`monorepo_subproject_policies`:

- `workspace_id`
- `repo_key`
- `subpath`
- `enabled`

`split_on_demand` 只读取 enabled 行。

## Resolver 行为摘要

- `shared_repo`:
  - active project = `repo_key`
- `split_on_demand`:
  - `(repo_key, subpath)` 启用 -> `repo_key#subpath`
  - 否则 -> `repo_key`
- `split_auto`:
  - 按现有 guardrail 执行自动拆分

## Rename 处理

repo/subpath rename 的 alias 自动管理仍是后续计划。
当前建议：临时保留旧条目，分阶段迁移。
