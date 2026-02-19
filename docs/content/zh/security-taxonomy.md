# 安全事件分类

Claustrum 会把安全相关审计事件和一般运维审计事件分流处理。

## Security Stream 包含的事件

- `auth.*`
- `access.*`
- `api_key.*`
- `raw.search`
- `raw.view`
- `audit.export`
- `oidc.*`
- `github.permissions.*`
- `security.*`

## Category 映射

- `auth.*`, `oidc.*` -> `auth`
- `access.*`, `github.permissions.*`, `security.*` -> `access`
- `raw.search`, `raw.view`, `audit.export` -> `data`
- `api_key.*` -> `config`

## Severity 映射

默认值：

- `high`: `api_key.*`, `audit.export`, `security.*`, 认证失败/撤销
- `medium`: `auth.*`, `access.*`, `raw.search`, `raw.view`, `oidc.*`, `github.permissions.*`
- `low`: 其他

可按事件覆盖：

```json
{
  "category": "auth",
  "severity": "high"
}
```

## Workspace 配置项

- `security_stream_enabled`（默认: `true`）
- `security_stream_sink_id`（可选专用 sink）
- `security_stream_min_severity`（`low|medium|high`，默认: `medium`）

若未配置专用 sink，会回退到已启用的安全 sink。
