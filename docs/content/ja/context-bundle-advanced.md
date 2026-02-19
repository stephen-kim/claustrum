# コンテキストバンドル（詳細）

このページは、`/v1/context/bundle` の debug 情報を使って品質調整する手順をまとめたものです。

## Global Routing 診断

`global.routing` で次を確認できます。

- `mode`: routing モード
- `q_used`: 実際に使われた query
- `selected_rule_ids`: 採用ルール
- `dropped_rule_ids`: 除外ルール
- `score_breakdown`: debug モード時

## Debug 手順

1. Admin UI の Context Debug を開く
2. query / subpath を入力（必要なら）
3. debug bundle を読み込む
4. 次を見比べる

- `retrieval.results[*].score_breakdown`
- `global.routing.score_breakdown`

## 典型的な調整

- 必要ルールが落ちる: `min_score` を下げる / `top_k` を上げる
- ノイズが多い: `min_score` を上げる / `top_k` を下げる / tags を改善
- 予算不足: pinned ルールを絞り、summary を活用

## 注意点

- raw 本文は bundle に入れない（参照のみ）
- routing debug は説明情報であり、権限制御を弱めない

最終更新: 2026-02-19
