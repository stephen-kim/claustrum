# 릴리스 게이트

Release Gate는 하나의 명령으로 고위험 출시 전 QC 검사를 실행합니다.

## 실행

```shell
RELEASE_GATE_RESET_DB=true ./scripts/release-gate.sh
```markdown
## 환경 변수

- `BASE_URL` (기본값: `http://localhost:8080`)
- `RELEASE_GATE_RESET_DB`(`true`/`false`, 기본값: `false`)
- `RELEASE_GATE_TIMEOUT_SEC` (기본값: `180`)
- `RELEASE_GATE_COMPOSE_FILE` (기본값: `docker-compose.dev.yml`)
- `RELEASE_GATE_COMPOSE_PROFILE` (기본값: `localdb`)

## 게이트 시퀀스

1. `pnpm lint`
2. `pnpm test`
3. `docker compose --profile localdb up -d`(`down -v`을 사용한 재설정 옵션)
4. `scripts/qc/bootstrap.sh`
5. `scripts/qc/isolation.sh`
6. `scripts/qc/rbac.sh`
7. `scripts/qc/webhooks.sh`
8. `scripts/qc/secrets.sh`

실패한 검사는 `1` 상태로 종료되고 명확한 오류가 인쇄됩니다.

Release Gate는 기본적으로 `MEMORY_CORE_RUN_SEED=false`을 설정하므로 부트스트랩 관리 흐름을 일관되게 검증할 수 있습니다.

## 각 QC 스크립트가 확인하는 사항

- `bootstrap.sh`
  - 부트스트랩 관리자 일회용 비밀번호 로그 동작
  - `must_change_password` 설정 전 게이팅
  - 설정이 완료되면 보호된 API가 열립니다.
- `isolation.sh`
  - 메모리/원시 검색을 위한 작업 공간 A/B 데이터 격리
- `rbac.sh`
  - 독자는 글을 쓸 수 없다
  - 작가는 글을 쓸 수 있지만 결정을 확인할 수는 없습니다.
  - 관리자는 결정을 확인할 수 있습니다.
  - 감사 내보내기는 관리자 전용으로 유지됩니다.
- `webhooks.sh`
  - 잘못된 서명이 `401`을 반환합니다.
  - 중복된 배송ID는 안전하게 처리됩니다.
- `secrets.sh`
  - 키/개인키/비밀번호 유출 패턴에 대한 로그 스캔
  - 해시된 API 키 저장에 대한 DB 스키마 확인
  - 일회성 API 키 보기는 재사용할 수 없습니다.

## CI 예시

```yaml
- name: Release Gate
  run: RELEASE_GATE_RESET_DB=true ./scripts/release-gate.sh
```
