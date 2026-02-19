# Outbound 语言与提示词调优

## 策略

- Admin UI 固定英文，不做界面多语言
- 数据库存储保持语言中立（`action`、`target`、metadata）
- locale 与模板调优只用于 outbound 集成（Slack/Jira/Confluence/Notion/Webhook/Email）

## locale 决策顺序

1. 请求参数 `locale`（显式覆盖）
2. integration policy 的 `locale_default`
3. workspace 的 `default_outbound_locale`
4. 最终回退 `en`

`supported_locales` 在 workspace 和 integration 两层都会生效。

## API

- `GET /v1/workspaces/:key/outbound-settings`
- `PUT /v1/workspaces/:key/outbound-settings`
- `GET /v1/outbound-policies/:integration_type?workspace_key=...`
- `PUT /v1/outbound-policies/:integration_type`
- `POST /v1/outbound/render`
- `GET /v1/outbound/template-variables?workspace_key=...&integration_type=...`

## 模板覆盖（Liquid）

```json
{
  "raw.search": {
    "en": "Searched raw logs for \"{{ q }}\" ({{ count }} results).",
    "ko": "원문 로그에서 \"{{ q }}\"를 검색했습니다. (결과 {{ count }}개)"
  }
}
```text

规则：
- outbound 渲染引擎固定为 Liquid
- override 优先于内置模板
- locale 缺失时回退到 `en`
- action key 缺失时回退到安全通用文案

Admin UI 提供变量目录（通用 + 按 action），方便直接编写模板而不必猜测运行时参数。
