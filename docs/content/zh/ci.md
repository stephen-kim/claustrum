# CI 指南

Claustrum 会在每个 PR 和每次 `main` push 运行 release gate。

## 主工作流

- 文件: `.github/workflows/ci.yml`
- 触发: `pull_request`, `push(main)`
- 作业: `release-gate`（`ubuntu-latest`, `timeout-minutes: 20`）

执行顺序：

1. checkout
2. setup Node 20 + pnpm
3. `pnpm install --frozen-lockfile`
4. 准备 CI 用 `.env`
5. `pnpm lint`
6. `pnpm test`
7. `RELEASE_GATE_RESET_DB=true ./scripts/release-gate.sh`
8. 始终执行 `docker compose ... down -v --remove-orphans`

## Docs Pages 工作流

- 文件: `.github/workflows/docs-pages.yml`

要点：
- docs build 前自动生成 OpenAPI
- 发布前校验 spec
- API 文档入口 `/docs/api`（Scalar）

首次部署前要求：
1. 在仓库 Settings 启用 Pages
2. 部署来源设置为 GitHub Actions

## Eval Comment 工作流

- 文件: `.github/workflows/eval-comment.yml`

功能：
- PR 自动跑 context bundle eval
- 更新 sticky comment（分数/失败项/diff）
- 运行 MCP schema snapshot guard
- guard 失败也会先上传 artifacts

## 本地复现

```shell
RELEASE_GATE_RESET_DB=true ./scripts/release-gate.sh
```text

## 快速排障

- `ERR_MODULE_NOT_FOUND @claustrum/shared/dist/index.js`:
  - 先执行 `pnpm --filter @claustrum/shared build`
- bootstrap QC 失败:
  - 检查 `localdb` profile 与 Postgres 变量
- webhook QC 失败:
  - 检查 `GITHUB_APP_WEBHOOK_SECRET`
