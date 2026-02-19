# 依赖管理（pnpm 标准）

## 基本策略

Claustrum 官方包管理器统一使用 **pnpm**。  
在这个仓库里，依赖相关操作都应通过 pnpm 完成。

- 安装 / 运行 / 更新统一用 `pnpm`
- 必须提交 `pnpm-lock.yaml`
- 不提交 `package-lock.json`、`yarn.lock`
- CI 必须使用 `pnpm install --frozen-lockfile`
- 不要在本仓库执行 `npm install`

## 为什么选 pnpm

- 单一 lockfile，结果可复现
- 安装更快、磁盘占用更省
- monorepo 场景下 `pnpm -r` 使用体验更好

## lockfile 规则

必需:
- `pnpm-lock.yaml`

禁止:
- `package-lock.json`
- `yarn.lock`

如果误生成 npm/yarn 的 lockfile，请删除后用 pnpm 重新安装。

## Workspace 布局

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```markdown

## 根脚本命令

- `pnpm dev` → `pnpm -r dev`
- `pnpm build` → `pnpm -r build`
- `pnpm lint` → `pnpm -r lint`
- `pnpm test` → `pnpm -r test`

## CI 规则

CI 需按以下顺序执行：

1. 安装 Node + pnpm
2. `pnpm install --frozen-lockfile`
3. `pnpm lint`
4. `pnpm build`
5. `pnpm test`

## 本地开发

```shell
pnpm install
pnpm dev
```

按需使用 package filter：

```shell
pnpm --filter @claustrum/memory-core dev
pnpm --filter @claustrum/admin-ui build
```markdown

## 防护规则

`.npmrc` 强制：

```ini
engine-strict=true
auto-install-peers=true
```
