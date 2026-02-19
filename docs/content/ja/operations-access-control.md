# 運用アクセス制御

このページは、workspace 導入時に権限まわりを安全に立ち上げるための運用手順です。

## 新規 Workspace 立ち上げ手順

1. workspace を作成
2. GitHub App を接続
3. repo sync 実行
4. repo -> project リンク確認
5. permission sync を dry-run で確認後、apply
6. OIDC を接続してログインチェック
7. 必要なら group mapping を設定
8. 監査ログで一連の操作を確認

## GitHub 側の手順

### Install / Sync

1. Workspace の GitHub Integration 画面を開く
2. Installation を接続
3. `Sync repos` 実行
4. Linked project を確認

### Permission Sync

1. まず dry-run
2. unmatched user を確認
3. `Claustrum user <-> GitHub login` をリンク
4. apply sync 実行

## OIDC 側の手順

1. Provider 情報を設定
2. issuer / client 設定を検証
3. `(issuer, subject)` で identity が作られることを確認
4. group mapping は stable group id で設定
5. 保護 API で OIDC gate が効いているか確認

## 障害調査の順番（推奨）

1. OIDC gate が通っているか
2. workspace membership があるか
3. GitHub installation が有効か
4. repo sync / link が正しいか
5. GitHub user link があるか
6. permission preview で direct/team max を確認
7. webhook delivery 状態を確認
8. permission apply の監査ログを確認

## 監視しておく監査イベント

- `github.webhook.received`
- `github.webhook.signature_failed`
- `github.repos.synced`
- `github.permissions.computed`
- `github.permissions.applied`
- `github.permissions.recomputed`
- `github.user_link.created`
- `github.user_link.deleted`

## 運用のコツ

- 初期は `add_only` 推奨
- 監査の精度に自信がついてから `add_and_remove`
- owner 保護ルールは常時 ON 推奨
- 可能な限り partial recompute を使う

最終更新: 2026-02-19
