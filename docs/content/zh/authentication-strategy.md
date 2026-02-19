# 认证策略

Claustrum 的认证采用分阶段策略，兼顾落地速度与后续安全增强。

## Phase 1（当前）：API Key

- 认证方式：`Authorization: Bearer <api_key>`
- Key 创建后只展示一次
- 支持 revoke
- 管理员 reset 通过 one-time link

服务端存储：
- 不存明文 key
- 只存 `key_hash`
- 用 `key_prefix` 做安全展示
- `device_label` 必填
- `expires_at` 可选

作用域：
- API key 按 workspace（`workspace_id`）隔离
- 禁止跨 workspace 访问

本地保存（MCP adapter）：
- `~/.claustrum/state.json`
- 写入时强制 `chmod 600`
- 若权限过宽会告警并尽量自动收紧

安全行为：
- key/token 不写日志
- debug/error 输出也会掩码敏感字段
- 网关返回 401/403 时给出重新登录提示

审计事件：
- `api_key.created`
- `api_key.revoked`
- `api_key.reset`
- `api_key.one_time_view`

## Phase 1 优点

- 上手快
- 运营简单
- 本地/远端 adapter 都适用

## Phase 1 限制

- `state.json` 里是明文 key（这是 Phase 1 的取舍）
- 不配置 `expires_at` 时 key 生命周期偏长

## Phase 2（规划中）：Device Flow + Keychain

- 引入 OAuth Device Flow 交互登录
- 短期 access token + 可轮换 refresh token
- refresh token 存 OS keychain（不是明文文件）
- 支持按设备 revoke 与更细粒度会话控制

兼容策略：
- 现有 API key 用户可继续使用
- 新登录逐步引导到 Device Flow

## 迁移路径

1. 保持 API key 接口与审计行为稳定
2. 增加 Device Flow 相关接口
3. 在 adapter 内引入 credential provider 抽象
4. 从 `state.json` API key 迁移到 keychain refresh token
5. 在兼容窗口内保留 API key fallback
