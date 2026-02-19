# GitHub 팀 매핑

## 목적

GitHub 팀 매핑은 GitHub 팀 멤버십을 작업 공간/프로젝트 범위의 Claustrum 역할에 연결합니다.

이는 웹훅 기반(`team`, `membership` 이벤트)이며 작업 영역 수준 정책을 사용합니다.

- `github_team_mapping_enabled`
- `github_webhook_sync_mode` (`add_only` / `add_and_remove`)

## 데이터 모델

`github_team_mappings` 필드:

- `workspace_id`
- `provider_installation_id` (선택사항)
- `github_team_id`, `github_team_slug`, `github_org_login`
- `target_type` (`workspace` | `project`)
- `target_key`
- `role`
- `priority`, `enabled`

## 매핑 동작

### append-only

- 누락된 멤버를 추가합니다.
- 새로운 역할이 더 높을 경우 역할을 업그레이드합니다.
- 기존 회원을 삭제하지 않습니다.

### 추가 및 제거

- 매핑과 일치하도록 구성원을 추가/업데이트합니다.
- 더 이상 매핑된 팀 범위에 없는 연결된 구성원을 제거합니다.
- 소유자/관리자 보호가 그대로 유지됩니다.

## 추천 역할

- 작업공간 대상: `OWNER` / `ADMIN` / `MEMBER`
- 프로젝트 대상 : `OWNER` / `MAINTAINER` / `WRITER` / `READER`

## 예

### 예시 1: 플랫폼 팀 -> 프로젝트 유지관리자

- 팀 : `acme/platform-team` (`github_team_id=42`)
- 대상 : `project`
- 대상 키 : `github:acme/platform`
- 역할: `MAINTAINER`

결과: `platform-team`에 연결된 사용자는 `github:acme/platform`에 대한 관리자 권한을 얻거나 유지합니다.

### 예시 2: 보안팀 -> 작업공간 관리자

- 팀 : `acme/security` (`github_team_id=77`)
- 대상 : `workspace`
- 대상 키 : `team-alpha`
- 역할: `ADMIN`

결과: `security`에 연결된 사용자가 `team-alpha`의 작업공간 관리자가 됩니다.

## 관리 UI

위치: **작업 공간 -> 통합 -> GitHub -> GitHub 팀 매핑**

작업:

- 매핑 생성
- 토글 활성화
- 매핑 제거

입력:

- 조직 로그인, 팀 슬러그, 팀 ID
- 대상 유형/키
- 역할
- 우선순위