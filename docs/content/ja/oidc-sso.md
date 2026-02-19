# OIDC SSO 連携

Claustrum は workspace 単位で OIDC SSO を使えます。
ログイン基盤は OIDC、project 権限の一次ソースは GitHub という分担です。

## Identity モデル

- ユーザー識別は `(issuer, subject)` を使用
- email はプロフィール情報として扱い、識別キーには使わない
- identity は `user_identities` に保存

## Provider 設定

Admin UI:
- Workspace -> **SSO Settings (OIDC)**

主な設定項目:
- `issuer_url`
- `client_id`
- `client_secret`
- `claim_groups_name`（既定: `groups`）
- `claim_groups_format`（推奨: `id`）
- `scopes`（既定: `openid profile email`）
- `enabled`

## ログインフロー

- `GET /v1/auth/oidc/:workspace_key/start`
- `GET /v1/auth/oidc/:workspace_key/callback`

処理の流れ:
1. start で PKCE + state を生成
2. IdP で認証
3. callback で code を token に交換
4. `id_token` 署名を JWKS で検証
5. `(issuer, sub)` を upsert
6. group mapping を membership に反映
7. セッション発行

## Group Claim の扱い

- `id`: 安定 ID（推奨）
- `name`: 可読名（rename で破綻しやすい）

## Provider 例

### Okta
- Issuer: `https://<your-okta-domain>/oauth2/default`
- Scopes: `openid profile email groups`

### Microsoft Entra ID
- Issuer: `https://login.microsoftonline.com/<tenant-id>/v2.0`
- Scopes: `openid profile email`
- group claim は ID 形式推奨

## セキュリティメモ

- email を主キーにしない
- `claim_groups_format=id` を優先
- client secret は定期ローテーション

最終更新: 2026-02-19
