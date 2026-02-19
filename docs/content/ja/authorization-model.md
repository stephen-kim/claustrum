# 認可モデル概要

## 基本方針

Claustrum は次の原則で認可を設計しています。

- ワークスペース分離は厳格に適用する
- プロジェクト権限の第一ソースは GitHub
- OIDC は認証とアクセスゲートの役割
- 手動オーバーライドは例外として扱い、必ず監査する

## 全体フロー

```text
User
  ↓
OIDC Login (Gate)
  ↓
Workspace Membership Check
  ↓
GitHub Permission Sync
  ↓
Manual Override (Exception)
  ↓
Effective Role
  ↓
Project Access (Allow / Deny)
```text

## ソースオブトゥルース

- プロジェクト単位の権限: **GitHub**
- 認証と入口制御: **OIDC**

## 優先順位

1. `manual_override`
2. `github_derived_role`
3. `oidc_boost_role`
4. `default_none`

## 代表シナリオ

- GitHub `write` + OIDC グループなし -> `writer`
- GitHub `read` + OIDC 昇格条件あり -> より高い方を採用
- 手動オーバーライド設定済み -> オーバーライド優先
- OIDC ゲート失敗 -> GitHub 権限に関係なく拒否
- GitHub チームから除外 -> 部分再計算で権限を縮小/削除

## 運用上の注意

- owner 保護ルールで誤削除を防ぐ
- 例外運用は期限付きで実施する
- 重要な変更は必ず監査ログで追える状態にする
