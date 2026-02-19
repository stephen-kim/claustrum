# グローバルルール

Global Rules は、チーム共通ルール（workspace）と個人ルール（user）を扱う仕組みです。

## スコープ

- `workspace`: チーム全体で共有するルール
- `user`: ユーザー個人のルール

## 設計方針

- 「最大 5 件」などの固定上限は設けません。
- token budget と score で動的に選びます。
- `pinned=true` と `severity=high` は最優先です。
- ルールが多すぎる場合は summary を併用します。

## 主要フィールド

- `title`, `content`
- `category`: `policy | security | style | process | other`
- `priority`: `1..5`
- `severity`: `low | medium | high`
- `pinned`, `enabled`

## API

- `GET /v1/global-rules?workspace_key=...&scope=workspace|user&user_id?`
- `POST /v1/global-rules`
- `PUT /v1/global-rules/:id`
- `DELETE /v1/global-rules/:id`
- `POST /v1/global-rules/summarize`

### Summarize モード

- `preview`: 要約テキストのみ返す
- `replace`: `global_rule_summaries` に保存して bundle 圧縮に使用

## ソフトガードレール

- `global_rules_recommend_max`（既定: 5）
- `global_rules_warn_threshold`（既定: 10）

挙動:
- 推奨値超過: info レベル案内
- 警告閾値到達: warn レベル警告

最終更新: 2026-02-19
