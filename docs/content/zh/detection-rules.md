# 检测规则

Detection Rules 用于按阈值识别可疑访问行为。

## 数据模型

- `detection_rules`: 规则定义
- `detections`: 检测结果（`open|ack|closed`）

## 规则示例

```json
{
  "name": "Raw search burst",
  "enabled": true,
  "severity": "high",
  "condition": {
    "type": "threshold",
    "action_key": "raw.search",
    "window_sec": 300,
    "count_gte": 20,
    "group_by": "actor_user_id"
  },
  "notify": {
    "via": "security_stream"
  }
}
```

## 引擎行为

- 每分钟运行一次
- 用最近 `audit_logs` 评估启用规则
- 为避免重复，按 `(rule, group, time-bucket)` 生成检测
- 触发时写入 `security.detection.triggered`

## 默认种子规则

- raw.search burst: 5 分钟内 `raw.search >= 20`
- permission churn: 10 分钟内 `access.project_member.role_changed >= 30`
- api key churn: 10 分钟内 `api_key.reset >= 5`

## 运维建议

- 先启用高严重级规则
- 观察一周后再调阈值
- 误报高时优先调整阈值与分组维度
