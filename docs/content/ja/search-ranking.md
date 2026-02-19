# 検索ランキング（Hybrid）

Claustrum の検索は hybrid（FTS + semantic）が基本です。

## ベース検索

- `keyword`: Postgres FTS
- `semantic`: embedding 類似度
- `hybrid`: 上記2つの重み付き統合

## 追加ブースト

- type boost（decision / constraint などの重み）
- recency boost（新しい情報を優先）
- subpath boost（shared_repo で現在 subpath と一致時）

## スコア式

`final = base_score * type_boost * recency_boost * subpath_boost`

## 調整設定

- `search_type_weights`
- `search_recency_half_life_days`（既定 14）
- `search_subpath_boost_weight`（既定 1.5）

## Debug で見える項目

- `vector`
- `fts`
- `type_boost`
- `recency_boost`
- `subpath_boost`
- `final`

最終更新: 2026-02-19
