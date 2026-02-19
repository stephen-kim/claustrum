# グループマッピング

Group Mapping は、IdP グループを Claustrum の workspace/project ロールに紐づける機能です。

## マッピング項目

- `provider_id`
- `claim_name`（例: `groups`）
- `group_id`（安定 ID）
- `group_display_name`（UI 表示用）
- `target_type`（`workspace` or `project`）
- `target_key`
- `role`
- `priority`
- `enabled`

## 対象ロール

### Workspace
- `OWNER`
- `ADMIN`
- `MEMBER`

### Project
- `OWNER`
- `MAINTAINER`
- `WRITER`
- `READER`

## Sync Mode

`workspace_settings.oidc_sync_mode`:

- `add_only`（既定）
  - 付与/更新のみ
  - 既存の非一致アクセスは残す
- `add_and_remove`
  - 非一致メンバーも削除対象
  - owner 保護ルールは維持

## マッピング例

1) Workspace admin 付与
- `group_id = 00gk9abc123xyz`
- `target_type = workspace`
- `target_key = personal`
- `role = ADMIN`

2) Project writer 付与
- `group_id = 00gk9devs123xyz`
- `target_type = project`
- `target_key = github:org/repo#apps/admin-ui`
- `role = WRITER`

## 運用のコツ

- group 名ではなく stable group id を使う
- 少数の高信頼マッピングから始める
- priority を使って競合時の優先度を整理する

最終更新: 2026-02-19
