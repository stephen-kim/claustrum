# グローバルルール ルーティング

Global Rules を毎回固定ブロックで入れると、文脈ノイズが増えます。
Claustrum は質問内容に合わせてルールを動的選別します。

## 常時含めるルール

- `pinned=true`
- `severity=high`

それ以外は routing score で選びます。

## Routing Mode

- `semantic`
- `keyword`
- `hybrid`（既定）

関連設定:
- `global_rules_routing_enabled`（既定: `true`）
- `global_rules_routing_mode`（既定: `hybrid`）
- `global_rules_routing_top_k`（既定: `5`）
- `global_rules_routing_min_score`（既定: `0.2`）

## スコア式（概念）

`score = semantic_similarity + keyword_overlap + priority_weight + recency_weight - length_penalty`

## query の決め方

1. API に明示された `q`
2. なければ project summary / active work / recent activity / subpath から疑似 query を生成

## token budget との関係

- 先にスコアで順位付け
- その後 budget を適用
- 収まらない場合は summary fallback

## Admin UI で見る場所

- Workspace -> Global Rules（routing 設定）
- Project -> Context Debug（採用/除外とスコア内訳）

## 運用の目安

- `top_k` は `3~8` が扱いやすい
- ノイズ多めなら `min_score` を上げる
- tags を増やすと keyword routing の精度が上がる

最終更新: 2026-02-19
