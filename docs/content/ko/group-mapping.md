# 그룹 매핑

Claustrum은 안정적인 `group_id` 값을 사용하여 IdP 그룹을 작업공간/프로젝트 역할에 매핑합니다.

## 매핑 기록

각 매핑에는 다음이 포함됩니다.

- `provider_id`
- `claim_name`(예: `groups`)
- `group_id` (안정적인 ID)
- `group_display_name`(UI 라벨만 해당)
- `target_type`: `workspace` 또는 `project`
- `target_key`: 작업공간 키 또는 프로젝트 키
- `role`
- `priority`
- `enabled`

## 역할 대상

### 작업공간 역할

- `OWNER`
- `ADMIN`
- `MEMBER`

### 프로젝트 역할

- `OWNER`
- `MAINTAINER`
- `WRITER`
- `READER`

## 동기화 모드

작업공간별로 구성됨(`workspace_settings.oidc_sync_mode`):

- `add_only`(기본값): 매핑된 액세스를 추가/업데이트하고 비교할 수 없는 액세스를 유지합니다.
- `add_and_remove`: 일치하지 않는 멤버십 삭제(소유자 보호 적용)

소유자 보호:

- 기존 `OWNER` 역할은 자동으로 다운그레이드/제거되지 않습니다.

## 매핑 예

1. 작업공간 관리자 매핑

- `group_id = 00gk9abc123xyz`
- `target_type = workspace`
- `target_key = personal`
- `role = ADMIN`

2. 프로젝트 작성자 매핑

- `group_id = 00gk9devs123xyz`
- `target_type = project`
- `target_key = github:org/repo#apps/admin-ui`
- `role = WRITER`

## 운영 조언

- IdP의 안정적인 `group_id` 소스 하나를 선호하세요.
- 더 강력한/기본 매핑을 위해서는 더 낮은 우선순위 번호를 사용하세요.
- 먼저 신뢰도가 높은 매핑의 작은 세트를 유지한 다음 확장하세요.