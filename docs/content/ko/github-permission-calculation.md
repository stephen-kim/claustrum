# GitHub 권한 계산

## 목적

Claustrum은 엄격한 병합 규칙을 사용하여 저장소 액세스를 계산합니다.

`final permission = max(direct collaborator permission, team-derived permissions)`

주문:

`admin > maintain > write > triage > read`

## 데이터 소스

연결된 각 저장소에 대해 다음을 수행합니다.

1. 직접 협력자(`/repos/{owner}/{repo}/collaborators`)
2. 레포팀(`/repos/{owner}/{repo}/teams`)
3. 팀원(`/orgs/{org}/teams/{slug}/members`)

팀 권한은 사용자 권한으로 확장된 다음 최대 규칙을 사용하여 직접 협력자 권한과 병합됩니다.

## 캐시 전략

작업공간 설정:

- `github_cache_ttl_seconds` (기본값: `900`)

캐시:

- `github_repo_teams_cache`
- `github_team_members_cache`
- `github_permission_cache`(저장소/사용자별로 계산)

행동:

- repo-team 또는 팀 구성원 캐시가 최신(< TTL)인 경우 캐시를 재사용합니다.
- 오래되었거나 누락된 경우 GitHub API를 호출하고 캐시를 업데이트하세요.
- 제한된 재시도를 통해 최선의 노력 모드로 동기화가 계속됩니다.

## 동기화 모드

### `add_only`

- 누락된 멤버를 추가합니다.
- 필요 시 역할 업그레이드
- 기존 회원을 제거하거나 다운그레이드하지 않습니다.

### `add_and_remove`

- 계산된 GitHub 권한과 일치하도록 연결된 사용자를 추가/업데이트/제거합니다.
- 소유자/관리자 보호는 계속 유효합니다.
- 성공적으로 계산된 저장소에 대해서만 제거가 적용됩니다.

## 엔드포인트

- `POST /v1/workspaces/:key/github/sync-permissions`
  - 본문 : `{ dry_run?: boolean, repos?: string[], project_key_prefix?: string }`
- `GET /v1/workspaces/:key/github/permission-preview?repo=owner/repo`
- `GET /v1/workspaces/:key/github/cache-status`

## 운영 참고 사항

- `dry_run=true`(미리보기 모드)로 시작하세요.
- 비교할 수 없는 사용자를 줄이려면 `github_user_links`을 최신 상태로 유지하세요.
- 이름 변경 안전을 위해 `github_user_id` 연결을 선호합니다.
- 속도 제한 경고가 나타나면 더 작은 저장소 하위 집합(`repos`)을 실행하거나 동기화 간격을 늘립니다.