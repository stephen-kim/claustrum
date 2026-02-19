# コンテキストバンドル API

Context Bundle は、Codex / Claude / Cursor などのクライアントが同じ形式でコンテキストを取得するための標準 API です。

## Endpoint

- `GET /v1/context/bundle`

## Query

- `workspace_key`（必須）
- `project_key`（必須）
- `q`（任意）
- `current_subpath`（任意）
- `mode=default|debug`（任意）
- `budget`（任意）

## 返却データ

- `project`: 対象プロジェクト情報
- `snapshot`: summary / decisions / constraints / active_work / recent_activity
- `retrieval`: 検索結果
- `global`: workspace/user global rules
- `debug`（`mode=debug` のときのみ）: スコア内訳、boost、予算配分

## 重要ルール

- 返すのは短く整理されたテキスト中心です。
- raw の本文は bundle に直接含めません。
- raw 参照は `evidence_ref` のみ返します。

## MCP 側での使い方

`mcp-adapter` の `context_bundle()` からこの API を呼び、`recall` / `remember` 前の文脈注入に使えます。

最終更新: 2026-02-19
