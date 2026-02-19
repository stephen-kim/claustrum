# 컨텍스트 번들 API

Claustrum은 Codex/Claude/Cursor와 유사한 클라이언트가 동일한 프로젝트 컨텍스트 형태를 사용할 수 있도록 정규화된 컨텍스트 번들을 제공합니다.

## 엔드포인트

- `GET /v1/context/bundle`

### 쿼리

- `workspace_key` (필수)
- `project_key` (필수)
- `q`(선택사항)
- `current_subpath`(선택사항)
- `mode` = `default` | `debug`(선택사항, 기본값 `default`)
- `budget` (선택)

## 응답 형태

```json
{
  "project": { "key": "github:owner/repo#apps/memory-core", "name": "memory-core" },
  "snapshot": {
    "summary": "...",
    "top_decisions": [],
    "top_constraints": [],
    "active_work": [],
    "recent_activity": []
  },
  "retrieval": {
    "query": "resolver fallback",
    "results": []
  },
  "debug": {
    "resolved_workspace": "personal",
    "resolved_project": "github:owner/repo",
    "monorepo_mode": "shared_repo",
    "current_subpath": "apps/memory-core",
    "boosts_applied": {},
    "token_budget": {}
  }
}
```
## 규칙

-번들은 MCP 클라이언트에 즉시 삽입할 수 있도록 간결하고 선별된 텍스트를 반환합니다.
- 원시 메시지 본문은 번들 페이로드에 직접 포함되지 않습니다.
- 원시 참조는 `evidence_ref`으로만 표시됩니다.
- `mode=debug`은 문제 해결을 위한 추가 점수 및 해결 세부 정보를 추가합니다.

## MCP 사용량

`mcp-adapter`은 `context_bundle()`을 노출하고 `recall`/`remember` 파이프라인 전에 이 엔드포인트를 호출할 수 있습니다.
