# OIDC ゲート

Claustrum では、OIDC は「本人確認と workspace 入場チェック」を担当します。
project 権限の一次ソースは GitHub です。

## OIDC の役割

- ユーザー本人を認証する
- workspace へのアクセス可否を判定する
- セッションの信頼境界を作る

OIDC は重要ですが、project 権限の最終決定者ではありません。

## ユーザー識別キー

OIDC ユーザーは次の組で識別します。

```text
(issuer, subject)
```

- email は変更される可能性があるため、主キーには使いません。

## グループマッピングの扱い

- 可能なら `group id`（不変）を使う
- `display name` は UI 表示用メタデータ
- グループマッピングはアクセス補助に使うが、project 権限の一次ソースは GitHub

## Sync Mode

| Mode | 意味 |
| --- | --- |
| `add_only` | OIDC 由来の付与を追加。既存の他経路の権限は残す |
| `add_and_remove` | 現在のマッピングに合わせて付与/削除（保護ルールあり） |

## この分離モデルのメリット

- OIDC: SSO / ID ライフサイクル管理
- GitHub: 実コード所有に近い project 権限
- Manual override: 例外対応（監査ログ付き）

## Guardrails

- OIDC gate に失敗したら、project 権限評価前に拒否
- identity link は workspace 単位で分離
- group claim 形式の不一致は設定リスクとして扱う
