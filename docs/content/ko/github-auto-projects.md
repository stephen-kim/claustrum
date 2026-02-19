# GitHub 자동 프로젝트

## 목적

작업공간 수준에서 동기화된 GitHub 저장소를 Claustrum 프로젝트에 자동으로 매핑합니다.

- 동기화는 항상 `github_repo_links`의 저장소를 캐시합니다.
- Repo 수준 프로젝트 자동 생성은 선택 사항입니다(`github_auto_create_projects`).
- 하위 프로젝트 자동 생성은 선택 사항이며 분할 모드(`github_auto_create_subprojects`)에서만 적용됩니다.

## 프로젝트 핵심 규칙

- 저장소 키: `{github_project_key_prefix}{owner}/{repo}`
- 하위 프로젝트 키 분할: `{github_project_key_prefix}{owner}/{repo}#{subpath}`

예:

- `github:acme/platform`
- `github:acme/platform#apps/admin-ui`

## 공유 vs 분할

- `shared_repo`(기본값):
  - 활성 프로젝트 키는 저장소 수준으로 유지됩니다.
  - 하위 경로는 `metadata.subpath`에 저장됩니다.
  - 검색/조회은 현재 하위 경로와 일치하는 행을 강화할 수 있습니다.
- `split_on_demand`:
  - 활성 키는 해당 하위 경로가 `monorepo_subproject_policies`에 나열된 경우에만 `repo#subpath`이 됩니다.
  - 목록에 없는 하위 경로는 항상 저장소 수준 프로젝트로 대체됩니다.
- `split_auto`:
  - 하위 경로가 감지될 때마다 활성 키는 `repo#subpath`이 될 수 있습니다.
  - 하위 프로젝트 자동 생성이 비활성화된 경우 확인자는 저장소 수준 프로젝트로 대체됩니다.

## 동기화 동작(`POST /v1/workspaces/:key/github/sync-repos`)

1. GitHub 앱 설치에서 리포지토리를 가져옵니다.
2. `github_repo_links` 행을 업로드합니다.
3. `github_auto_create_projects=true`인 경우:
   - repo 수준 프로젝트를 Upsert합니다.
   - `project_mappings(kind=github_remote, external_id=owner/repo)`을 확인하세요.
   - `github_repo_links.linked_project_id`을 저장소 수준 프로젝트에 연결합니다.
4. 동기화 중에는 하위 프로젝트 프로젝트가 생성되지 않습니다.

## 해석기 동작(`POST /v1/resolve-project`)

- `shared_repo`:
  - repo 수준 프로젝트로 해결합니다.
  - 하위 경로는 별도의 프로젝트 키로 변환되지 않습니다.
- `split_on_demand`:
  - 하위 경로가 감지되고 정책 행이 존재하는 경우 `repo#subpath`을 해결합니다.
  - 정책 행이 누락된 경우 리포지토리 수준 프로젝트로 대체됩니다.
- `split_auto`:
  - 하위 경로가 감지되면 `repo#subpath`을 시도하세요.
  - 하위 프로젝트 매핑/프로젝트가 누락된 경우:
    - `github_auto_create_subprojects=true`인 경우에만 자동 생성됩니다.
    - 그렇지 않으면 저장소 수준 프로젝트로 대체됩니다.

## 하위 경로 가드레일

- 슬래시와 대소문자를 표준화합니다.
- 공백과 유효하지 않은 문자를 `-`으로 바꾸세요.
- 빈 경로 세그먼트를 제거합니다.
- `monorepo_max_depth`을 시행합니다.
- `node_modules`, `.git`, `dist`, `build`, `.next` 등 차단된 경로를 제외합니다.

## 감사 이벤트

- `github.repos.synced`
- `github.projects.auto_created`
- `github.projects.auto_linked`