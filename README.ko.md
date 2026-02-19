# Claustrum

![Claustrum Banner](./.github/assets/banner.png)

[English README](README.md) | [한국어 README](README.ko.md) | [日本語 README](README.ja.md) | [Español README](README.es.md) | [中文 README](README.zh.md)

Claustrum은 AI 시스템을 위한 공유 메모리 계층입니다. 프로젝트, 도구, 팀 전반의 컨텍스트를 통합합니다.


## 이 프로젝트가 하는 일

- 여러 컴퓨터/여러 작업자 간 메모리 컨텍스트를 공유합니다.
- MCP 운영 안전성(`stdout` 오염 방지, 정책 기반 동작)을 보장합니다.
- Admin UI에서 워크스페이스/프로젝트/유저/권한/감사 로그를 관리합니다.
- Notion/Jira/Confluence/Linear/Slack 같은 외부 컨텍스트를 연동합니다.


## 왜 필요한가

AI 개발 컨텍스트는 쉽게 분산됩니다.

- 컴퓨터마다 기억 상태가 다름
- 팀원마다 보는 문맥이 다름
- 커밋/채팅/문서에 결정 사항이 흩어짐

Claustrum은 이 문제를 팀 단위의 공유 메모리 시스템으로 바꿉니다.


## 핵심 구성요소

- **Memory Core**: REST API + 정책 + Postgres 저장소
- **MCP Adapter**: Memory Core를 호출하는 stdio MCP 브리지
- **Admin UI**: 팀 운영 관리 대시보드
- **Shared Package**: 공용 스키마/타입/유틸


## 문서 정책 (Pages 중심)

이 README는 개요만 유지합니다. 상세 설치/설정/운영 문서는 GitHub Pages로 배포되며 소스는 `docs/content`에 있습니다.

- [문서 사이트 (GitHub Pages)](https://stephen-kim.github.io/claustrum/)
- MCP 설정 원라인 헬퍼:
  `curl -fsSL https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -o ./claustrum-mcp-config-helper.js && node ./claustrum-mcp-config-helper.js`


## 저장소 구조

```text
apps/
  docs-site/
  memory-core/
  mcp-adapter/
  admin-ui/
packages/
  shared/
```


## Upstream

- Upstream (`upstream`): `https://github.com/Intina47/context-sync.git`
