# CI ガイド

Claustrum は PR と `main` への push で release gate を実行します。

## メインワークフロー

- ファイル: `.github/workflows/ci.yml`
- トリガー: `pull_request`, `push(main)`
- ジョブ: `release-gate`（`ubuntu-latest`, `timeout-minutes: 20`）

実行順:

1. checkout
2. Node 20 + pnpm セットアップ
3. `pnpm install --frozen-lockfile`
4. CI 用 `.env` 生成
5. `pnpm lint`
6. `pnpm test`
7. `RELEASE_GATE_RESET_DB=true ./scripts/release-gate.sh`
8. 常に `docker compose ... down -v --remove-orphans`

## Docs Pages ワークフロー

- ファイル: `.github/workflows/docs-pages.yml`

要点:
- docs build 前に OpenAPI を自動生成
- 生成 spec を検証してから Pages に公開
- API ドキュメントは `/docs/api`（Scalar）

初回デプロイ前の必須条件:
1. Repository Settings -> Pages を有効化
2. Build source を GitHub Actions に設定

## Eval Comment ワークフロー

- ファイル: `.github/workflows/eval-comment.yml`

要点:
- PR ごとに context bundle eval 実行
- sticky comment を更新
- schema snapshot guard 結果もコメントへ反映
- 失敗時も artifacts を先にアップロード

## ローカル再現

```shell
RELEASE_GATE_RESET_DB=true ./scripts/release-gate.sh
```

## トラブルシューティング

- `ERR_MODULE_NOT_FOUND (@claustrum/shared/dist/index.js)`:
  - `pnpm --filter @claustrum/shared build` を先に実行
- bootstrap QC 失敗:
  - `localdb` profile と Postgres 変数確認
- webhook QC 失敗:
  - `GITHUB_APP_WEBHOOK_SECRET` を確認
