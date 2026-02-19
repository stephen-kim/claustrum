# 모노레포 컨텍스트 모드

Claustrum은 모노레포 메모리 범위에 대해 세 가지 작업공간 수준 정책을 지원합니다.

## 모드

### 1) `shared_repo`(기본값)

- 활성 `project_key`은 저장소 수준: `github:org/repo`에 유지됩니다.
- 감지된 하위 경로는 `metadata.subpath`으로 메모리 메타데이터에 저장됩니다.
- 리콜/검색은 `current_subpath`을 사용하여 하위 경로 순위 향상을 적용할 수 있습니다.
- 팀이 소음을 줄이면서 하위 프로젝트 간 메모리 공유를 원할 때 적합합니다.

### 2) `split_on_demand`(분할 기본값 권장)

- 활성 `project_key`은 `monorepo_subproject_policies`에 하위 경로가 나열된 경우에만 분할됩니다.
- 나열된 하위 경로의 경우 키는 `github:org/repo#apps/admin-ui`이 됩니다.
- 목록에 없는 하위 경로의 경우 확인자는 저장소 수준 키로 대체됩니다.
- 특정 패키지/앱만 격리가 필요한 경우에 적합

### 3) `split_auto`(고급)

- 감지된 모든 하위 경로는 `repo#subpath`으로 확인될 수 있습니다.
- 하위 프로젝트에 대한 자동 생성이 활성화되면 누락된 하위 프로젝트가 자동으로 생성될 수 있습니다.
- 엄격한 경로 위생 및 가드레일을 갖춘 성숙한 모노레포에 가장 적합합니다.

## 작업공간 설정

- `monorepo_context_mode`: `shared_repo` | `split_on_demand` | `split_auto`
- `monorepo_subpath_metadata_enabled`: `metadata.subpath`을 공유 모드로 저장
- `monorepo_subpath_boost_enabled`: 공유 모드에서 현재 하위 경로에 대한 결과 부스트를 적용합니다.
- `monorepo_subpath_boost_weight`: 부스트 승수(기본값 `1.5`)

## 예시 키

- 공유: `github:acme/claustrum`
- 분할: `github:acme/claustrum#apps/memory-core`

## 메모

- 리졸버 대체 순서는 변경되지 않습니다: `github_remote > repo_root_slug > manual`
- 분할 모드에서 하위 경로 감지가 실패하면 Claustrum은 repo 키로 대체됩니다.
- 관리 UI 컨트롤은 **프로젝트 해결 설정 → Monorepo 컨텍스트**에 있습니다.