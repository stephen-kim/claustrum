# 検知ルール

Detection Rules は、不審なアクセスパターンを閾値ベースで検出する仕組みです。

## データモデル

- `detection_rules`: ルール定義
- `detections`: 検出結果（`open|ack|closed`）

## ルール例（Threshold）

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

## エンジン動作

- 1 分ごとに worker 実行
- 有効ルールを最近の `audit_logs` で集計
- 重複防止のため `(rule, group, time-bucket)` ごとに 1 件作成
- `security.detection.triggered` を発行

## 既定ルール

- raw.search burst: 5分で `raw.search >= 20`
- permission churn: 10分で `access.project_member.role_changed >= 30`
- api key churn: 10分で `api_key.reset >= 5`

## 運用

- 高重大度ルールから開始
- 1 週間観測して閾値調整
- 誤検知が多いルールは `group_by` と閾値を見直す
