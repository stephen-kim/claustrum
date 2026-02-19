# 搜索排序（Hybrid）

Claustrum 默认使用 hybrid 检索（FTS + semantic）。

## 基础检索

- `keyword`: Postgres FTS 候选
- `semantic`: embedding 相似度候选
- `hybrid`: 两者加权融合

## 额外加权

- type boost（优先 decision / constraint 等）
- recency boost（越新权重越高）
- subpath boost（`shared_repo` 下子路径匹配时加权）

## 评分公式

`final = base_score * type_boost * recency_boost * subpath_boost`

## 可调参数

- `search_type_weights`
- `search_recency_half_life_days`（默认 14）
- `search_subpath_boost_weight`（默认 1.5）

## Debug 字段（`debug=true`）

- `vector`
- `fts`
- `type_boost`
- `recency_boost`
- `subpath_boost`
- `final`

最后更新: 2026-02-19
