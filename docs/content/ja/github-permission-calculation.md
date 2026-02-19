# GitHub 権限計算

このドキュメントは、Claustrum が GitHub 権限をどう計算するかを説明します。

## 計算ルール

最終権限は次で決まります。

```text
final_permission = max(direct collaborator permission, team-derived permissions)
```

優先順位:

```text
admin > maintain > write > triage > read
```

## 使うデータ

各 repo について次を取得します。

1. direct collaborators
2. repo teams
3. team members

team 権限を user 単位に展開し、direct 権限と max ルールで合成します。

## キャッシュ

設定:
- `github_cache_ttl_seconds`（既定: 900）

キャッシュ:
- `github_repo_teams_cache`
- `github_team_members_cache`
- `github_permission_cache`

挙動:
- TTL 内ならキャッシュ利用
- 期限切れ/未存在なら GitHub API 再取得
- 同期は限定リトライ付きベストエフォート

## Sync Mode

### `add_only`
- 不足メンバーを追加
- 必要な昇格のみ反映
- 既存メンバーの削除/降格はしない

### `add_and_remove`
- GitHub 計算結果に合わせて追加/更新/削除
- owner/admin 保護ルールを維持
- 計算成功した repo にのみ削除を適用

## 関連 API

- `POST /v1/workspaces/:key/github/sync-permissions`
- `GET /v1/workspaces/:key/github/permission-preview?repo=owner/repo`
- `GET /v1/workspaces/:key/github/cache-status`

## 運用メモ

- 本番適用前に `dry_run=true` 推奨
- `github_user_links` を最新化して unmatched を減らす
- rename 耐性のため `github_user_id` の保存推奨
