# モノレポ 分離ポリシー

## モード一覧

`monorepo_context_mode` は次の 3 モードをサポートします。

1. `shared_repo`（デフォルト）
2. `split_on_demand`
3. `split_auto`（advanced）

## 比較

### `shared_repo`

- active project key は repo レベル（`github:owner/repo`）
- subpath は metadata として保持し、ランキングに利用
- 運用コストが最も低い

### `split_on_demand`

- 明示的に登録した subpath だけ分離
- 判定元は `monorepo_subproject_policies`
- 未登録 subpath は repo レベルのまま
- 本番運用で最も扱いやすい分離戦略

### `split_auto`

- guardrail 付きで `repo#subpath` を自動生成/利用
- 便利だが project 数が増えやすい
- 自動分割を許容できるチームだけ有効化推奨

## split_on_demand を推奨する理由

- 大規模 monorepo での project 爆発を防ぎやすい
- 境界を管理者が明示的に制御できる
- 分離不要な領域では shared context を維持できる

## 運用ガイド

1. まず `shared_repo` から開始
2. 分離が必要な subpath が出たら `split_on_demand` へ移行
3. 分離したい subpath だけ policy に追加
4. `split_auto` は自動拡張を許容できる場合のみ使用

## policy テーブル

`monorepo_subproject_policies`

- `workspace_id`
- `repo_key`
- `subpath`
- `enabled`

`split_on_demand` では enabled な行のみ有効。

## resolver の要約

- `shared_repo`:
  - active project = `repo_key`
- `split_on_demand`:
  - `(repo_key, subpath)` が有効なら `repo_key#subpath`
  - それ以外は `repo_key`
- `split_auto`:
  - 既存 guardrail に従って自動分割

## rename について

repo/subpath rename の alias 管理は将来対応予定です。
現時点では旧エントリを一時維持し、段階的に移行する運用を推奨します。
