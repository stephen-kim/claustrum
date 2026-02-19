# OIDC SSO 集成

Claustrum 支持按 workspace 配置 OIDC 登录。
OIDC 负责身份与入口校验，项目权限主来源仍是 GitHub。

## 身份模型

- 身份键：`(issuer, subject)`
- email 仅做资料字段，不作主键
- 记录存储在 `user_identities`

## Provider 配置

Admin UI:
- Workspace -> **SSO Settings (OIDC)**

关键字段：
- `issuer_url`
- `client_id`
- `client_secret`
- `claim_groups_name`（默认 `groups`）
- `claim_groups_format`（推荐 `id`）
- `scopes`（默认 `openid profile email`）
- `enabled`

## 登录流程

- `GET /v1/auth/oidc/:workspace_key/start`
- `GET /v1/auth/oidc/:workspace_key/callback`

步骤：
1. start 生成 PKCE + 签名 state
2. 用户在 IdP 登录
3. callback 用 code 换 token
4. 用 JWKS 验签 `id_token`
5. upsert `(issuer, sub)`
6. 应用 group mapping
7. 发放会话

## Group Claim 说明

- `id`: 稳定，推荐
- `name`: 易受重命名影响

## Provider 示例

### Okta
- Issuer: `https://<your-okta-domain>/oauth2/default`
- Scopes: `openid profile email groups`

### Microsoft Entra ID
- Issuer: `https://login.microsoftonline.com/<tenant-id>/v2.0`
- Scopes: `openid profile email`
- 推荐输出 group ID claim

## 安全建议

- 不要用 email 作为稳定身份键
- 尽量使用 `claim_groups_format=id`
- 定期轮换 client secret

最后更新: 2026-02-19
