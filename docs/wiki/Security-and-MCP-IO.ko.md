# 보안 및 MCP I/O

## MCP stdio 정책

MCP 서버/어댑터는 다음을 준수해야 합니다.
- `stdout`: JSON-RPC 프로토콜 메시지만 출력
- `stderr`: 로그/에러만 출력

배너/디버그 출력/마이그레이션 메시지를 stdout으로 보내면 안 됩니다.

## Raw 데이터 가드레일

- raw 검색은 snippet만 반환
- raw 단건 조회도 snippet만 반환
- `max_chars` 제한 강제
- 기본 동작에서 raw 세션 전체 원문 반환 금지

## 접근 제어

- API key 인증 필요 (`Authorization: Bearer <key>`)
- raw 검색/조회 권한:
  - admin 또는 project member
  - workspace 전체 raw 검색은 workspace admin/owner 필요

## 감사(audit) 요구사항

다음 액션을 기록/검토:
- `raw.search`
- `raw.view`

audit 로그에는 actor, target, timestamp가 포함되어야 합니다.

## 배포 보안 노트

- 외부 DB 연결은 TLS 사용 (`sslmode=require` 등)
- API key 주기적 교체
- stderr 로그에 비밀정보 출력 금지
