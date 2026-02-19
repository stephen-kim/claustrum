# GitHub 権限モデル

Claustrum の project 権限は、基本的に GitHub を一次ソースとして計算します。

## 全体像

- workspace ごとに GitHub App installation を接続
- repo 情報を workspace ローカルに同期
- GitHub 権限から project role を算出

## Repo -> Project の基本ルール

- 既定キー: `github:owner/repo`
- shared モード: repo 単位 project を利用
- split モード: 条件に応じて subproject（`repo#subpath`）に分離

## 権限計算

```text
final_perm = max(direct_collaborator_perm, team_derived_perm)
```

優先順位:

```text
admin > maintain > write > triage > read
```

## Team 連携

計算には次を使います。

- repo -> teams
- team -> members
- member -> Claustrum user link

最終的に GitHub permission を Claustrum role mapping へ変換します。

## Webhook ベース部分再計算

- `installation_repositories`: 変更 repo だけ再同期/再計算
- `team` / `membership`: 影響 repo だけ再計算
- `repository` rename: メタデータ更新（権限再計算は通常不要）
- `team_add` / `team_remove`: 関連 cache を無効化して再計算

## Cache 戦略

- `github_repo_teams_cache`
- `github_team_members_cache`
- `github_permission_cache`

原則:
- 通常読み取りは TTL を使う
- イベント受信時は影響範囲のみ invalidate
- 再計算時に permission cache を上書き

## Sync Mode

| Mode | 動作 |
| --- | --- |
| `add_only` | 追加/昇格のみ。古いアクセスは残す |
| `add_and_remove` | GitHub 現在状態に合わせて追加/昇格/削除（保護ルールあり） |

## 運用チェックリスト

1. installation 接続確認
2. repo sync / project link 確認
3. user link 確認
4. permission preview 確認
5. webhook 状態と監査ログ確認
