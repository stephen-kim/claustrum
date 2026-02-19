# Decision 抽出パイプライン

Claustrum は Git raw event を常に保存します。  
そのうえで、次の 2 段階パイプラインを実行します。

1. Raw Event -> Activity Memory
2. Raw Event -> Decision Memory（LLM 分類）

## フロー

```mermaid
flowchart TD
  A["Git post-commit / post-merge / post-checkout"] --> B["POST /v1/raw-events"]
  B --> C["raw_events persisted (always)"]
  C --> D{"event_type commit/merge?"}
  D -- "yes" --> E["Create activity memory (type=activity)"]
  D -- "no (checkout)" --> F["Skip activity memory"]
  C --> G{"decision extraction enabled?"}
  G -- "yes" --> H["Async LLM batch job"]
  H --> I{"LLM label=decision?"}
  I -- "yes" --> J["Create decision memory (draft by default)"]
  I -- "no" --> K["Mark event as processed (not_decision)"]
  G -- "no" --> L["No decision job"]
```markdown

## 重要ルール

`decision_keyword_policies` は **LLM 実行順序の調整のみ** に使います。

- それ自体で memory は作成しない
- それ自体で decision を確定しない
- `decision_extraction_mode=hybrid_priority` のときだけ優先順に影響

## Decision ステータス

デフォルト:
- `decision_default_status = draft`
- `decision_auto_confirm_enabled = false`

auto-confirm を使う場合:
- `decision_auto_confirm_enabled = true`
- `confidence >= decision_auto_confirm_min_confidence`

## LLM 出力契約

分類器は次の JSON 形式を想定します。

```json
{
  "label": "decision | not_decision",
  "confidence": 0.0,
  "summary": "1-2 lines",
  "reason": ["bullet 1", "bullet 2"],
  "tags": ["optional-tag"]
}
```

## 運用メモ

- LLM キー/設定がなければ安全にスキップして後で再試行
- activity logging は低コストで安定
- コスト制御に効く設定:
  - `decision_batch_size`
  - `decision_backfill_days`
  - `decision_extraction_mode`
