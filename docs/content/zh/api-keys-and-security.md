# API Key 与安全

Claustrum 的 API Key 策略是：只显示一次，数据库只存哈希。

## 安全模型

- API Key 明文不入库。
- 仅存 `api_keys.key_hash`。
- 管理员也不能回看历史明文 Key。
- 用户可自行创建 Key。
- 管理员可执行 revoke / reset。
- reset 通过一次性链接分发（默认 15 分钟有效）。

## 主要流程

### 1) 用户自助创建
- `POST /v1/api-keys`
- 明文 Key 只在响应里返回一次。

### 2) Key 列表
- `GET /v1/api-keys`（本人）
- `GET /v1/users/:userId/api-keys`（admin 或本人）
- 仅返回元数据，不返回明文。

### 3) Revoke
- `POST /v1/api-keys/:id/revoke`
- Key 所有人或 admin 可执行。

### 4) Admin reset + 一次性链接
- `POST /v1/users/:userId/api-keys/reset`
- 撤销目标用户有效 Key 并生成新 Key。
- 不直接返回明文，返回 one-time URL。

### 5) One-time view
- `GET /v1/api-keys/one-time/:token`
- 仅可使用一次。
- 过期或重复使用返回 `410 Gone`。

## 审计事件

- `api_key.created`
- `api_key.revoked`
- `api_key.reset`
- `api_key.one_time_view`

## 运维建议

- 按设备设置 `device_label`
- 及时回收不用的 Key
- 怀疑泄露时立即 reset

最后更新: 2026-02-19
