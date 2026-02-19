# モノレポ コンテキストモード

Claustrum では monorepo の記憶スコープを workspace 単位で選べます。

## モード

### 1) `shared_repo`（デフォルト）

- active `project_key` は repo レベルのまま（`github:org/repo`）
- 検出した subpath は `metadata.subpath` に保存
- recall/search 時に `current_subpath` 一致をブースト可能
- サブプロジェクト間で知識共有したいチーム向け

### 2) `split_on_demand`（推奨 split デフォルト）

- `monorepo_subproject_policies` に登録した subpath だけ分離
- 分離時は `github:org/repo#apps/admin-ui` 形式
- 未登録 subpath は repo レベルにフォールバック
- 特定パッケージだけ隔離したいときに最適

### 3) `split_auto`（上級者向け）

- 検出した subpath を自動で `repo#subpath` として扱う
- 自動作成が有効なら不足 subproject を作成可能
- 境界管理がしっかりした大規模 monorepo 向け

## 主な設定

- `monorepo_context_mode`: `shared_repo` | `split_on_demand` | `split_auto`
- `monorepo_subpath_metadata_enabled`: shared 時に `metadata.subpath` を保存
- `monorepo_subpath_boost_enabled`: shared 時に subpath 一致をブースト
- `monorepo_subpath_boost_weight`: ブースト倍率（デフォルト `1.5`）

## key 例

- Shared: `github:acme/claustrum`
- Split: `github:acme/claustrum#apps/memory-core`

## 補足

- resolver の優先順は従来どおり（`github_remote > repo_root_slug > manual`）
- split 系で subpath 検出に失敗した場合は repo key にフォールバック
- UI 設定は **Project Resolution Settings -> Monorepo Context**
