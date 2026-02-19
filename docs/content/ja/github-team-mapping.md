# GitHub チームマッピング

## 目的

GitHub Team Mapping は、GitHub team の所属情報を Claustrum の role に反映する仕組みです。
workspace レベル/ project レベルの両方に適用できます。

この機能は webhook（`team`, `membership`）を起点に動き、次の設定を使います。

- `github_team_mapping_enabled`
- `github_webhook_sync_mode`（`add_only` / `add_and_remove`）

## データモデル

`github_team_mappings` の主な項目:

- `workspace_id`
- `provider_installation_id`（任意）
- `github_team_id`, `github_team_slug`, `github_org_login`
- `target_type`（`workspace` / `project`）
- `target_key`
- `role`
- `priority`, `enabled`

## 同期モードの動き

### add_only

- 不足メンバーを追加
- より高い role が必要なら更新
- 既存メンバーの削除はしない

### add_and_remove

- マッピング結果に合わせて追加/更新
- 対象から外れたリンクメンバーを削除
- owner/admin 保護ルールは維持

## 推奨 role

- workspace target: `OWNER` / `ADMIN` / `MEMBER`
- project target: `OWNER` / `MAINTAINER` / `WRITER` / `READER`

## 例

### 例 1: platform team -> project maintainer

- Team: `acme/platform-team` (`github_team_id=42`)
- Target: `project`
- Target key: `github:acme/platform`
- Role: `MAINTAINER`

結果: `platform-team` に紐づいたユーザーは `github:acme/platform` で maintainer 権限を持つ。

### 例 2: security team -> workspace admin

- Team: `acme/security` (`github_team_id=77`)
- Target: `workspace`
- Target key: `team-alpha`
- Role: `ADMIN`

結果: `security` のリンクユーザーは `team-alpha` の workspace admin になる。

## Admin UI

場所: **Workspace -> Integrations -> GitHub -> GitHub Team Mappings**

できること:
- マッピング作成
- enabled の切り替え
- マッピング削除

入力項目:
- org login / team slug / team id
- target type / target key
- role
- priority
