# MCP 어댑터 아키텍처

Claustrum은 MCP 어댑터를 로컬에서 씬 프로세스로 실행하는 반면 컨텍스트 논리와 데이터는 원격 Claustrum 서비스에 유지됩니다.

## 런타임 레이아웃

```text
~/.claustrum/
  bin/claustrum-mcp
  adapter/
    current/
    versions/vX.Y.Z/
  logs/
    adapter.log
    error.log
  state.json
  update.lock
```text
## 요청 경로

1. MCP 클라이언트는 stdio를 통해 JSON-RPC를 보냅니다.
2. 로컬 어댑터는 stdin에서 MCP 프레임을 구문 분석합니다.
3. 어댑터는 각 페이로드를 `POST ${CLAUSTRUM_BASE_URL}/v1/mcp`으로 전달합니다.
4. 원격 JSON-RPC 응답은 MCP 프레임으로 stdout에 다시 기록됩니다.
5. 로그는 stderr/files에만 기록됩니다.

## 로깅 및 stdout 안전

- `stdout`: JSON-RPC 전용입니다.
- `stderr`: 작업 로그입니다.
- 로그 순환 정책:
  - `adapter.log` 최대 5MB
  - `error.log` 최대 5MB
  - 총 `~/.claustrum/logs` 최대 10MB

API 키, 전달자 토큰, 개인 키 블록과 같은 민감한 값은 로깅 전에 마스킹됩니다.

## 자동 업데이트 흐름

- ETag를 사용하여 GitHub 릴리스를 확인합니다.
- 동시 업데이트 경합을 방지하려면 `update.lock`을 사용합니다.
- `SHA256SUMS`으로 다운로드된 런타임을 확인합니다.
- `adapter/current` 심볼릭 링크를 원자적으로 교환합니다.
- 실패 시 이전 버전을 유지합니다.

## 보안 기본값

- 프로덕션에서는 `CLAUSTRUM_BASE_URL`에 대해 HTTPS를 사용해야 합니다.
- 어댑터는 TLS 인증서 확인을 비활성화하지 않습니다.
- 업데이트 소스는 승인된 저장소에 고정됩니다.

## 문제 해결

- 업스트림 연결 불가: `CLAUSTRUM_BASE_URL`, 네트워크, TLS 신뢰 체인을 확인하세요.
- 업데이트 건너뛰기: `~/.claustrum/state.json`, `update.lock`, `~/.claustrum/logs/error.log`을 확인하세요.
- MCP 프로토콜 오류: 비프로토콜 출력이 stdout에 기록되지 않았는지 확인합니다.