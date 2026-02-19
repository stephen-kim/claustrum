# 홈

Claustrum은 AI 팀을 위한 공유 메모리 레이어입니다.  
여러 저장소, 여러 도구, 여러 작업자 사이에서 컨텍스트가 끊기지 않도록 도와줍니다.

## 이런 걸 할 수 있어요

- 구조화된 메모리 저장/조회 (`decision`, `constraint`, `active_work`, `activity`)
- MCP를 안전하게 운영 (`stdout`은 JSON-RPC만, 로그는 `stderr`)
- GitHub 권한 + OIDC 접근 제어 연동
- 감사 로그/타임라인/보존 정책 기반 운영
- Context Bundle, Global Rules, Persona, Debug 화면으로 품질 튜닝

## 먼저 보면 좋은 문서

- [설치](installation)
- [환경 변수](environment-variables)
- [인증 전략](authentication-strategy)
- [운영 가이드](operations)
- [API 레퍼런스](api-reference)

## MCP 설정 원라인 헬퍼

macOS / Linux:

```shell
curl -fsSL https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -o ./claustrum-mcp-config-helper.js && node ./claustrum-mcp-config-helper.js
```

Windows PowerShell:

```powershell
iwr https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -OutFile .\claustrum-mcp-config-helper.js; node .\claustrum-mcp-config-helper.js
```

## 구성 요소

- `memory-core`: REST API + Postgres + 정책 엔진
- `mcp-adapter`: MCP stdio 브리지(메모리 코어 호출)
- `admin-ui`: 워크스페이스/권한/연동/감사 운영 콘솔

## 문서 안내

- 이 문서는 실제 운영자/사용자 관점으로 작성되었습니다.
- 구현 상세보다 “어떻게 쓰고 운영하는지”에 초점을 둡니다.
