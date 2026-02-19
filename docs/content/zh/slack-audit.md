# Slack 审计集成

## 目标

把审计事件发送到 Slack，方便团队快速看到：

- 谁改了配置
- 改了什么
- 为什么改

这是出站通知集成，不提供 MCP 读取工具。

## 你需要准备

- Slack Incoming Webhook URL
- `workspace_key`（例：`personal`）

## ENV（回退）

- `MEMORY_CORE_AUDIT_SLACK_WEBHOOK_URL`
- `MEMORY_CORE_AUDIT_SLACK_ACTION_PREFIXES`
- `MEMORY_CORE_AUDIT_SLACK_DEFAULT_CHANNEL`
- `MEMORY_CORE_AUDIT_SLACK_FORMAT`
- `MEMORY_CORE_AUDIT_SLACK_INCLUDE_TARGET_JSON`
- `MEMORY_CORE_AUDIT_SLACK_MASK_SECRETS`

## 配置步骤

1. 在 Slack 创建 Incoming Webhook
2. 在 Admin UI（Integrations -> Slack Audit）保存配置
   - `enabled=true`
   - `webhook_url`
   - 可选：`default_channel`, `action_prefixes`, `format`, `routes`, `severity_rules`
3. 可选：通过 API 保存
4. 触发一条审计事件并验证 Slack 是否收到

## 常用配置项

- `webhook_url`
- `default_channel`
- `action_prefixes`
- `format`（`detailed` / `compact`）
- `include_target_json`
- `mask_secrets`
- `routes`
- `severity_rules`

## ENV 与 Admin UI 优先级

- 默认：Admin UI（DB）优先
- `MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS=slack` 时强制 ENV

## 故障排查

- 没有消息：检查 webhook、`enabled=true`、prefix/严重级过滤
- provider locked：检查 integration lock 配置
