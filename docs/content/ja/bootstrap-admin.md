# 初期管理者セットアップ

Claustrum には初回インストール向けの bootstrap admin フローがあります。

## 初期アカウント

- 最初に作られる管理者メールは `admin@example.com` 固定
- `users` テーブルが空のときだけ bootstrap 実行
- 初期パスワードはサーバーログに **1 回だけ** 出力

出力例:

```text
Bootstrap admin created: admin@example.com
Initial password (shown once): <random-password>
```text

## 初回ログイン後に必須の作業

bootstrap 資格情報でログインした直後は、セットアップ完了まで通常機能を使えません。

1. メール変更（必須、`admin@example.com` のまま不可）
2. パスワード変更（必須）
3. 表示名設定（任意）

完了前に許可される API:
- `/v1/auth/me`
- `/v1/auth/complete-setup`
- `/v1/auth/logout`

それ以外の `/v1/*` は `403` で拒否されます。

## 再インストール / DB リセット時

- DB 初期化後に `users` が空なら、bootstrap が再実行され新しい one-time パスワードが出ます
- 1 人でも user が存在すれば bootstrap は動きません

## セキュリティ上の注意

- bootstrap パスワード出力は機密情報として扱う
- ログイン後すぐに実運用パスワードへ変更する
- 起動ログを外部公開しない
