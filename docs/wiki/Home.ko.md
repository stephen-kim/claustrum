# context-sync 위키 홈

## 개요

context-sync는 MCP 클라이언트를 위한 팀 확장형 Memory Core 시스템입니다.

구성:
- `memory-core`: REST API + Postgres 데이터 레이어
- `mcp-adapter`: memory-core를 호출하는 stdio MCP 어댑터
- `admin-ui`: 운영 대시보드

핵심 원칙:
- MCP 안전성: `stdout`은 JSON-RPC만, 로그는 `stderr`
- 기본 recall: 정제된 `memories`만 조회
- raw 검색: snippet-only + audit 로그

## 다음 문서

- [설치 가이드](Installation.ko)
- [운영 가이드](Operations.ko)
- [보안 및 MCP I/O](Security-and-MCP-IO.ko)
- [Notion 연동](Notion-Integration.ko)
- [Atlassian 연동](Atlassian-Integration.ko)
- [Linear 연동](Linear-Integration.ko)
- [릴리즈 노트](Release-Notes.ko)
- [Installation (English)](Installation)
