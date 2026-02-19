# GitHub 自动项目创建

## 目标

把 GitHub 同步过来的仓库，自动映射为 Claustrum 的 workspace 项目。

- 同步时仓库信息一定会写入 `github_repo_links`
- repo 级项目是否自动创建由 `github_auto_create_projects` 控制
- subproject 是否自动创建由 `github_auto_create_subprojects` 控制（仅 split 模式）

## Project key 规则

- repo key: `{github_project_key_prefix}{owner}/{repo}`
- split subproject key: `{github_project_key_prefix}{owner}/{repo}#{subpath}`

示例：
- `github:acme/platform`
- `github:acme/platform#apps/admin-ui`

## Shared 与 Split

- `shared_repo`（默认）
  - active project 保持 repo 级
  - subpath 存到 `metadata.subpath`
  - recall/search 可对当前 subpath 做加权

- `split_on_demand`
  - 仅对 `monorepo_subproject_policies` 中列出的 subpath 做拆分
  - 未列出的 subpath 回退到 repo 级项目

- `split_auto`
  - 检测到 subpath 时可自动走 `repo#subpath`
  - 若未开启 subproject 自动创建，则回退 repo 级

## 同步行为（`POST /v1/workspaces/:key/github/sync-repos`）

1. 从 GitHub App installation 拉取仓库
2. upsert `github_repo_links`
3. 若 `github_auto_create_projects=true`：
   - upsert repo 级项目
   - 确保 `project_mappings(kind=github_remote, external_id=owner/repo)`
   - 把 `github_repo_links.linked_project_id` 关联到 repo 级项目
4. 同步阶段不创建 subproject

## Resolver 行为（`POST /v1/resolve-project`）

- `shared_repo`:
  - 始终解析到 repo 级项目
- `split_on_demand`:
  - 命中 policy 才解析为 `repo#subpath`
  - 未命中则回退 repo 级
- `split_auto`:
  - 先尝试 `repo#subpath`
  - 缺少 project/mapping 时：
    - 仅 `github_auto_create_subprojects=true` 才自动创建
    - 否则回退 repo 级

## Subpath 护栏

- 统一斜杠与大小写
- 空格/非法字符替换为 `-`
- 删除空 path segment
- 应用 `monorepo_max_depth`
- 排除 `node_modules`, `.git`, `dist`, `build`, `.next`

## 审计事件

- `github.repos.synced`
- `github.projects.auto_created`
- `github.projects.auto_linked`
