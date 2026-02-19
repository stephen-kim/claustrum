# オンボーディング

Claustrum のオンボーディングは、招待リンク中心で最短導入できる設計です。

## エンドツーエンド

1. 管理者がメンバーを招待
2. 招待リンクを共有
3. メンバーがリンクから初期パスワード設定
4. ログイン
5. Welcome Setup で以下を実施
   - API key 作成（必須）
   - Git auto-capture 設定（任意・推奨）

## Invite API

- `POST /v1/workspaces/:key/invite`
  - 入力: `email`, `role`, `project_roles?`
  - 出力: `invite_url`, `expires_at`
- `GET /v1/invite/:token`
  - トークン検証 + 招待情報取得
- `POST /v1/invite/:token/accept`
  - ユーザー作成/更新、ロール付与、token 使用済み化

## Welcome Setup

初回ログイン時、API key がなければ Welcome Setup へ誘導されます。

Step 1:
- API key 生成（平文は 1 回表示）

Step 2（任意）:
- Git auto-capture コマンドをコピー
- インストール完了を記録（監査ログ）

## 監査イベント

- `invite.created`
- `invite.accepted`
- `api_key.created`
- `api_key.revoked`
- `git_capture.installed`

## セキュリティ

- 招待トークンはハッシュ保存
- 有効期限は 24 時間
- API key はハッシュのみ保存
- 管理者でも既存 API key の平文再表示不可

最終更新: 2026-02-19
