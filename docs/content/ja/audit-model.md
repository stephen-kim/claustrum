# 監査ログモデル

Claustrum の監査ログは「改ざんしにくく、追跡しやすい」を最優先に設計しています。

## 基本原則

- append-only
- `UPDATE` / `DELETE` は DB で禁止
- `correlation_id` で一連の操作を追跡
- export 操作も監査対象

## append-only の強制

`audit_logs` はトリガーで次を強制します。

- 許可: `INSERT`
- 拒否: `UPDATE`, `DELETE`

## よく使う action_key

- `access.workspace_member.*`
- `access.project_member.*`
- `audit.export`
- `audit.retention.run`

## Correlation ID

同じ処理に紐づくイベントを束ねます。

例:

- GitHub webhook delivery
- permission sync job
- OIDC 同期トランザクション

## エクスポート

- `GET /v1/audit/export`
- 形式: `csv` / `json`
- 権限: workspace admin 以上

最終更新: 2026-02-19
