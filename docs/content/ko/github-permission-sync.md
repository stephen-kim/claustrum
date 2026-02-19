# GitHub 권한 동기화

## 개요

GitHub 권한 동기화는 두 부분으로 구성됩니다.

1. Claustrum 사용자를 GitHub ID(`github_user_links`)에 연결합니다.
2. 저장소 권한을 Claustrum 프로젝트 역할에 동기화

자세한 권한 계산 및 캐시 동작은 다음을 참조하세요.

- [GitHub 권한 계산](github-permission-calculation)

## 흐름

1. GitHub 앱 설치 연결
2. 리포지토리 수준 프로젝트를 캐시하고 연결하기 위해 리포지토리 동기화
3. 사용자 링크 생성(`user_id` ← `github_login`, 선택 `github_user_id`)
4. 권한 동기화 실행(`dry_run` 먼저(미리보기) 후 적용)
5. Claustrum은 역할 매핑 전에 `max(direct collaborator, team-derived permission)`을 계산합니다.

## 모드

### `add_only`(기본값)

- 누락된 `project_members` 추가
- GitHub 권한이 더 높은 역할을 의미할 때 역할을 업그레이드합니다.
- 회원을 삭제하지 않습니다.
- 회원을 다운그레이드하지 않습니다.

### `add_and_remove`

- 연결된 사용자에 대해 추가/업데이트/제거를 적용합니다.
- 더 이상 리포지토리 권한이 없는 연결된 사용자를 제거합니다.
- 소유자 보호 규칙이 적용됩니다.

## 기본 역할 매핑

```json
{
  "admin": "maintainer",
  "maintain": "maintainer",
  "write": "writer",
  "triage": "reader",
  "read": "reader"
}
```text
## 운영 팁

- 프로덕션 작업 공간에 변경 사항을 적용하기 전에 `dry_run=true`을 사용하세요.
- 대규모 설치는 예약된 배치로 동기화되어야 합니다.
- GitHub API 제한으로 인해 부분적인 성공이 발생할 수 있습니다. 동기화 결과에서 repo 오류 목록을 확인하세요.
- 이름 변경 복원력을 위해 `github_user_id`을 저장하는 것이 좋습니다(로그인은 변경될 수 있음).

## 일치하지 않는 사용자

GitHub 공동 작업자에게 `github_user_links` 일치 항목이 없는 경우:

- `skipped_unmatched`으로 계산됩니다.
- `unmatched_users` 미리보기에 나타납니다.
- 해당 ID에 대해서는 Claustrum 역할이 변경되지 않습니다.

## 엔드포인트

- `GET /v1/workspaces/:key/github/user-links`
- `POST /v1/workspaces/:key/github/user-links`
- `DELETE /v1/workspaces/:key/github/user-links/:userId`
- `POST /v1/workspaces/:key/github/sync-permissions`
- `GET /v1/workspaces/:key/github/permission-status`
- `GET /v1/workspaces/:key/github/permission-preview?repo=owner/repo`
- `GET /v1/workspaces/:key/github/cache-status`