# ロール解決仕様

## 計算式

```python
effective_role = max(
    manual_override,
    github_role,
    oidc_role
)

access_allowed = (
    oidc_gate_passed
    AND effective_role != none
)
```text

## 入力

- `manual_override`: 管理者が設定した明示的な例外
- `github_role`: GitHub 同期で得たロール
- `oidc_role`: OIDC グループマッピングによる昇格ロール
- `oidc_gate_passed`: OIDC 認証 + workspace ゲート通過

## ロール階層

### Workspace

| Rank | Role |
|---|---|
| 3 | owner |
| 2 | admin |
| 1 | member |
| 0 | none |

### Project

| Rank | Role |
|---|---|
| 4 | owner |
| 3 | maintainer |
| 2 | writer |
| 1 | reader |
| 0 | none |

## 競合解決ルール

1. 役割をランクで比較
2. 最大ランクを `effective_role` とする
3. OIDC ゲート失敗時は必ず拒否
4. ロール判定前に workspace 分離を適用

## 同期モード

### `add_only`

- 追加と必要な昇格のみ
- 削除・降格はしない

### `add_and_remove`

- 追加/更新/削除をすべて適用
- owner 保護ルールは常に有効

## 手動オーバーライド

- 例外用途に限定
- 監査ログ必須
- 期間制限付き運用を推奨
