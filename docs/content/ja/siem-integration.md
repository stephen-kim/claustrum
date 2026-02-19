# SIEM 連携

Claustrum は監査イベントを外部 SIEM に送信できます（Audit Sinks）。

## データ構成

- `audit_sinks`: 送信先、フィルタ、再試行ポリシー
- `audit_delivery_queue`: `(sink_id, audit_log_id)` 単位の配信キュー

## 配信フロー

1. `audit_logs` にイベントが追加
2. `event_filter` で対象 sink を選別
3. `audit_delivery_queue` に enqueue
4. worker が HTTP POST 送信
5. 成功: `delivered` / 失敗: backoff 再試行後 `failed`

## 署名

ヘッダー:
- `X-Claustrum-Event`
- `X-Claustrum-Workspace`
- `X-Claustrum-Delivery`
- `X-Claustrum-Signature: sha256=<hex>`

計算:

```text
HMAC_SHA256(secret, raw_json_body)
```

## Retry / Backoff

```json
{
  "max_attempts": 5,
  "backoff_sec": [1, 5, 30, 120, 600]
}
```

## Admin UI

`Workspace -> Integrations -> SIEM`

- Sink 作成
- Test delivery
- 配信状態確認（queued/sending/delivered/failed）
