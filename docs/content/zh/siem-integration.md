# SIEM 集成

Claustrum 可通过 Audit Sinks 将审计事件推送到外部 SIEM。

## 数据结构

- `audit_sinks`: 目标地址、过滤规则、重试策略
- `audit_delivery_queue`: 按 `(sink_id, audit_log_id)` 持久化排队

## 投递流程

1. `audit_logs` 写入事件
2. 根据 `event_filter` 选中 sink
3. 写入 `audit_delivery_queue`
4. worker 发起 HTTP POST
5. 成功记为 `delivered`，失败按 backoff 重试，最终 `failed`

## 签名

请求头：
- `X-Claustrum-Event`
- `X-Claustrum-Workspace`
- `X-Claustrum-Delivery`
- `X-Claustrum-Signature: sha256=<hex>`

计算方式：

```text
HMAC_SHA256(secret, raw_json_body)
```

## 重试策略

```json
{
  "max_attempts": 5,
  "backoff_sec": [1, 5, 30, 120, 600]
}
```

## Admin UI

`Workspace -> Integrations -> SIEM`

- 新建 sink
- 发送测试事件
- 查看投递状态（queued/sending/delivered/failed）
