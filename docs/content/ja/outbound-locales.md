# Outbound ロケールとプロンプト調整

## ポリシー

- Admin UI の表示言語は英語固定
- DB の監査/イベントデータは言語中立のまま保存
- ロケールやテンプレート調整は outbound 連携（Slack/Jira/Confluence/Notion/Webhook/Email）にのみ適用

## ロケール決定順

出力ロケールは次の順で決まります。

1. API リクエスト側の `locale` override
2. integration policy の `locale_default`
3. workspace の `default_outbound_locale`
4. 最終フォールバック `en`

`supported_locales` は workspace と integration の両方でフィルタとして効きます。

## API

- `GET /v1/workspaces/:key/outbound-settings`
- `PUT /v1/workspaces/:key/outbound-settings`
- `GET /v1/outbound-policies/:integration_type?workspace_key=...`
- `PUT /v1/outbound-policies/:integration_type`
- `POST /v1/outbound/render`
- `GET /v1/outbound/template-variables?workspace_key=...&integration_type=...`

## Template override（Liquid）

```json
{
  "raw.search": {
    "en": "Searched raw logs for \"{{ q }}\" ({{ count }} results).",
    "ko": "원문 로그에서 \"{{ q }}\"를 검색했습니다. (결과 {{ count }}개)"
  }
}
```

ルール:
- outbound テンプレートエンジンは Liquid 固定
- override が built-in より優先
- 対象ロケールがなければ `en` へフォールバック
- action key がなければ安全な汎用文へフォールバック

Admin UI では変数カタログ（共通 + アクション別）を表示するため、テンプレート作成時に runtime 変数を推測する必要はありません。
