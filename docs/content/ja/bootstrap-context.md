# 初期コンテキスト（Bootstrap）

Bootstrap Context は、プロジェクト作成直後に最低限の共有文脈を自動で用意する機能です。

## 実行タイミング

- 自動: project 作成時（ベストエフォート）
- 手動 API: `POST /v1/projects/:key/bootstrap`
- Admin UI: Project Settings の `Bootstrap context`

## 参照ソース

利用可能な範囲で次を読み取ります。

- `README.md`
- `package.json`
- `docker-compose.yml` / `docker-compose.yaml`
- `infra/docker-compose.yml` / `infra/docker-compose.yaml`
- 最近の Git raw events（`post_commit`, `post_merge`, `post_checkout`）

## 生成される memory

- `type`: `summary`
- `status`: `confirmed`
- `source`: `auto`
- `metadata.source`: `bootstrap`
- `metadata.files`: 使ったファイル一覧

## 失敗時の挙動

- bootstrap は非ブロッキングです。
- ファイル不足や読み取り失敗があってもプロジェクトは継続して利用できます。
- 必要なら何度でも手動再実行できます。

最終更新: 2026-02-19
