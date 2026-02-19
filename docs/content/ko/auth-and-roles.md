# 인증 및 역할

Claustrum은 사용자 ID에 매핑된 API 키 인증을 사용한 다음 작업 공간/프로젝트 역할 확인을 시행합니다.

## 롤모델

### 작업공간 역할
- `owner`
- `admin`
- `member`

### 프로젝트 역할
- `owner`
- `maintainer`
- `writer`
- `reader`

작업 공간 `owner/admin`은 운영 복구를 위해 동일한 작업 공간 내의 프로젝트 멤버십 확인을 재정의할 수 있습니다.

## 권한 부여 맵

| 액션 | 최소 역할 |
| --- | --- |
| 워크스페이스 멤버 나열 | 작업공간 `member` |
| 워크스페이스 멤버 관리 | 작업공간 `admin` |
| 프로젝트 생성/나열 | 작업공간 `member` |
| 프로젝트 구성원 나열 | 프로젝트 `reader` |
| 프로젝트 구성원 관리 | 프로젝트 `maintainer` |
| 추억 만들기 | 프로젝트 `writer` |
| 추억 읽기 | 프로젝트 `reader` |
| 결정 확인/거부 | 프로젝트 `maintainer` |
| 원시 검색/원시 보기 | `raw_access_min_role`의 프로젝트 역할(기본값 `writer`) |

## 원시 액세스 정책

- `workspace_settings.raw_access_min_role`은 `/v1/raw/search` 및 `/v1/raw/messages/:id`의 최소 프로젝트 역할을 제어합니다.
- 기본값은 `WRITER`입니다.
- 모든 원시 액세스 요청이 감사됩니다(`raw.search`, `raw.view`).

## 감사

중요한 작업을 수행하면 항상 `audit_logs` 항목이 생성됩니다.
- `memory.create`
- `memory.update`
- `memory.delete`
- `decision.confirm`
- `decision.reject`
- 회원 및 API 키 관리 조치

`/v1/audit-logs` 필터를 사용하세요.
- `workspace_key` (필수)
- `project_key`
- `action_key` (정확히)
- `action_prefix`
- `actor_user_id`
- `limit`