# GitHub 自動プロジェクト作成

## 目的

GitHub から同期したリポジトリを、workspace 単位で Claustrum project に自動マッピングします。

- 同期時にリポジトリ情報は必ず `github_repo_links` に保存
- repo レベル project の自動作成は `github_auto_create_projects` で制御
- subproject の自動作成は `github_auto_create_subprojects` で制御（split 系モードのみ）

## Project key ルール

- repo key: `{github_project_key_prefix}{owner}/{repo}`
- split subproject key: `{github_project_key_prefix}{owner}/{repo}#{subpath}`

例:
- `github:acme/platform`
- `github:acme/platform#apps/admin-ui`

## Shared と Split の違い

- `shared_repo`（デフォルト）
  - active project は repo レベルのまま
  - subpath は `metadata.subpath` に保存
  - recall/search で current_subpath 一致をブースト可能

- `split_on_demand`
  - `monorepo_subproject_policies` に登録された subpath だけ `repo#subpath` に分離
  - 未登録 subpath は repo レベルへフォールバック

- `split_auto`
  - 検出された subpath を自動で `repo#subpath` として扱える
  - 自動作成が無効なら repo レベルへフォールバック

## 同期動作（`POST /v1/workspaces/:key/github/sync-repos`）

1. GitHub App installation から repos を取得
2. `github_repo_links` を upsert
3. `github_auto_create_projects=true` の場合:
   - repo レベル project を upsert
   - `project_mappings(kind=github_remote, external_id=owner/repo)` を保証
   - `github_repo_links.linked_project_id` を repo project に接続
4. 同期段階では subproject を作成しない

## Resolver 動作（`POST /v1/resolve-project`）

- `shared_repo`:
  - 常に repo レベルへ解決
- `split_on_demand`:
  - policy にある subpath だけ `repo#subpath` へ解決
  - policy がなければ repo レベルへフォールバック
- `split_auto`:
  - subpath 検出時に `repo#subpath` を試行
  - project/mapping がなければ
    - `github_auto_create_subprojects=true` のときのみ作成
    - それ以外は repo レベルへフォールバック

## Subpath ガードレール

- スラッシュ/大文字小文字を正規化
- 空白や不正文字を `-` に置換
- 空の path segment を削除
- `monorepo_max_depth` を適用
- `node_modules`, `.git`, `dist`, `build`, `.next` は除外

## 監査イベント

- `github.repos.synced`
- `github.projects.auto_created`
- `github.projects.auto_linked`
