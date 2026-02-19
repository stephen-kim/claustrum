# セキュリティ分類

Claustrum は、一般監査ログとセキュリティ関連イベントを分離して扱います。

## Security Stream に入るイベント

- `auth.*`
- `access.*`
- `api_key.*`
- `raw.search`
- `raw.view`
- `audit.export`
- `oidc.*`
- `github.permissions.*`
- `security.*`

## Category マッピング

- `auth.*`, `oidc.*` -> `auth`
- `access.*`, `github.permissions.*`, `security.*` -> `access`
- `raw.search`, `raw.view`, `audit.export` -> `data`
- `api_key.*` -> `config`

## Severity マッピング

既定値:

- `high`: `api_key.*`, `audit.export`, `security.*`, 認証失敗/失効
- `medium`: `auth.*`, `access.*`, `raw.search`, `raw.view`, `oidc.*`, `github.permissions.*`
- `low`: 上記以外

必要ならイベント側で上書きできます。

```json
{
  "category": "auth",
  "severity": "high"
}
```

## Workspace 設定

- `security_stream_enabled`（既定: `true`）
- `security_stream_sink_id`（専用 sink、任意）
- `security_stream_min_severity`（`low|medium|high`、既定: `medium`）

専用 sink が未設定の場合は、有効な security 対応 sink にフォールバックします。
