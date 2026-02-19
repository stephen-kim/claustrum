# 依存関係管理（pnpm 標準）

## 基本方針

Claustrum の公式パッケージマネージャーは **pnpm** です。
このリポジトリでは、依存関係の操作はすべて pnpm で統一します。

- インストール / 実行 / 更新は `pnpm` を使用
- `pnpm-lock.yaml` は必ずコミット
- `package-lock.json` と `yarn.lock` はコミットしない
- CI でも `pnpm install --frozen-lockfile` を使用
- このリポジトリで `npm install` は実行しない

## なぜ pnpm か

- モノレポ全体を 1 つの lockfile で再現可能に管理できる
- インストールが速く、ディスク効率が高い
- `pnpm -r` でワークスペース全体の操作がしやすい

## lockfile ルール

必須:
- `pnpm-lock.yaml`

禁止:
- `package-lock.json`
- `yarn.lock`

もし誤って npm/yarn の lockfile が生成された場合は削除し、pnpm で再インストールしてください。

## ワークスペース構成

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```markdown

## ルートコマンド

- `pnpm dev` → `pnpm -r dev`
- `pnpm build` → `pnpm -r build`
- `pnpm lint` → `pnpm -r lint`
- `pnpm test` → `pnpm -r test`

## CI ルール

CI では次の順で実行します。

1. Node + pnpm をセットアップ
2. `pnpm install --frozen-lockfile`
3. `pnpm lint`
4. `pnpm build`
5. `pnpm test`

## ローカル開発

```shell
pnpm install
pnpm dev
```

必要に応じて filter を使います。

```shell
pnpm --filter @claustrum/memory-core dev
pnpm --filter @claustrum/admin-ui build
```markdown

## ガードレール

`.npmrc` で次を強制しています。

```ini
engine-strict=true
auto-install-peers=true
```
