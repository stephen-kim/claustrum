# 액세스 타임라인 감사


## 목적

Claustrum은 관리자가 다음 사항에 답할 수 있도록 액세스 변경 감사를 표준화합니다.

- 누가 액세스 권한을 변경했나요?
- 무엇이 바뀌었나(추가/역할변경/삭제)?
- 변경된 이유(수동 작업, GitHub 동기화, OIDC 매핑 또는 시스템 프로세스)는 무엇입니까?
- 어떤 배치/작업/웹훅이 원인입니까?

이 페이지에는 이벤트 카테고리 및 액세스 타임라인 UI 동작이 문서화되어 있습니다.

## 액션 키 분류

Workspace 멤버십 이벤트:

- `access.workspace_member.added`
- `access.workspace_member.role_changed`
- `access.workspace_member.removed`

프로젝트 멤버십 이벤트:

- `access.project_member.added`
- `access.project_member.role_changed`
- `access.project_member.removed`

이는 다음을 위해 방출됩니다.

- 수동 관리자/회원 변경(`source: "manual"`)
- GitHub 권한 동기화 / 팀 매핑 업데이트 (`source: "github"`)
- OIDC 그룹 매핑 변경 (`source: "oidc"`)
- 시스템 중심 흐름(`source: "system"`)

## 표준 `params` 계약

각 액세스 감사 이벤트에는 최소한 다음이 포함됩니다.

- `source`: `manual | github | oidc | system`
- `target_user_id`
- `old_role`(추가된 경우 Null 가능)
- `new_role`(제거 시 null 가능)
- `workspace_key`
- `project_key` (프로젝트 이벤트에만 해당)
- `correlation_id` (선택사항이지만 권장함)
- `evidence` (선택적 json 객체)

예(역할 변경):

```json
{
  "source": "github",
  "target_user_id": "usr_123",
  "old_role": "READER",
  "new_role": "WRITER",
  "workspace_key": "acme",
  "project_key": "github:acme/platform",
  "correlation_id": "gh-delivery-6fd9...",
  "evidence": {
    "repo": "acme/platform",
    "team": "backend",
    "permission": "write"
  }
}
```
## 상관 ID 사용

단일 작업으로 대량 업데이트를 그룹화하려면 `correlation_id`을 사용하세요.

권장 값:

- GitHub 웹훅 전달 ID
- 권한 동기화 작업 ID
- OIDC 동기화 트랜잭션 ID

Access Timeline UI에서는 `correlation_id`이 동일한 이벤트를 하나의 배치로 함께 검사할 수 있습니다.

## 타임라인 API에 액세스

끝점:

- `GET /v1/audit/access-timeline`

쿼리:

- `workspace_key` (필수)
- `project_key`(선택사항)
- `user_id` (선택, 대상 사용자)
- `source`(선택사항)
- `action`(선택사항: `add | change | remove`)
- `from`, `to`(옵션 ISO 날짜/시간)
- `limit`, `cursor`(페이지 매김)

응답:

- `items[]` 표준화된 액세스 이벤트 포함
- 페이지 매김을 위한 `next_cursor`

## 관리 UI 필터

관리 콘솔 -> 감사 로그 -> 액세스 타임라인은 다음을 지원합니다.

- 프로젝트 필터
- 대상 사용자 필터
- 소스 필터(`manual/github/oidc/system`)
- 액션 필터(`add/change/remove`)
- 기간(`from`, `to`)
- 커서 페이지 매김(`Load more`)

각 행에는 다음이 표시됩니다.

- 타임스탬프
- 사람이 읽을 수 있는 요약
- 소스 뱃지
- 배우 (`actor_user_id` 또는 `system_actor`)
- 확장 가능한 세부정보(`params`, `correlation_id`, `evidence`)
- JSON 작업 복사

## 운영 지침

- 웹훅 사고 발생 시 `source=github` + `correlation_id`을 사용하세요.
- IdP 그룹 매핑 효과를 검증할 때는 `source=oidc`을 사용하세요.
- 사용자별 접근 조사에는 `user_id` 필터를 사용하세요.
- 외부 권한을 처음 활성화할 때 `add_only` 동기화 모드를 선호합니다. 검증 후 `add_and_remove`으로 이동하세요.
