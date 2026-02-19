# GitHub 통합(작업공간 범위)

## 범위

이 페이지에서는 GitHub 통합의 기초를 다룹니다.

- 하나의 GitHub 앱 설치를 하나의 Claustrum 작업 공간에 연결
- 저장소 인벤토리를 Claustrum에 동기화
- 프로젝트 연결 및 권한 동기화에 사용할 수 있는 저장소 메타데이터를 유지합니다.

고급 동작에 대해서는 다음을 참조하세요.

- [GitHub 자동 프로젝트](github-auto-projects)
- [GitHub 권한 동기화](github-permission-sync)
- [GitHub 웹훅](github-webhooks)

## 작업공간 수준 모델

각 작업공간에는 **0 또는 1** GitHub 앱 설치가 있을 수 있습니다.

- `github_installations`: 작업공간별 설치 메타데이터
- `github_repo_links`: 검색 및 향후 매핑을 위해 동기화된 저장소 캐시

## 환경 변수

서버 측 GitHub 앱 호출에 필요:
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`

선택사항:
- `GITHUB_APP_WEBHOOK_SECRET` (웹훅 처리를 활성화하는 경우 필수)
- `GITHUB_APP_NAME` 또는 `GITHUB_APP_URL` (링크 생성 설치)
- `MEMORY_CORE_GITHUB_STATE_SECRET`(서명된 상태 재정의)

`GITHUB_APP_PRIVATE_KEY`은 다음을 지원합니다.
- 원시 PEM
- 이스케이프된 줄바꿈이 있는 PEM(`\n`)
- base64로 인코딩된 PEM

## 설치 흐름

```mermaid
sequenceDiagram
  participant AdminUI
  participant MemoryCore
  participant GitHub
  AdminUI->>MemoryCore: GET /v1/workspaces/:key/github/install-url
  MemoryCore-->>AdminUI: { url (signed state) }
  AdminUI->>GitHub: Open installation URL
  GitHub->>MemoryCore: GET /v1/auth/github/callback?installation_id&state
  MemoryCore->>MemoryCore: Verify signed state + workspace admin
  MemoryCore->>GitHub: Fetch installation details (App JWT)
  MemoryCore->>MemoryCore: Upsert github_installations
  MemoryCore-->>GitHub: 200 JSON (connected)
```text
## API 엔드포인트

- `GET /v1/workspaces/:key/github/install-url`
  - 인증: 작업공간 관리자+
  - 서명된 `state`이 포함된 GitHub 앱 설치 URL을 반환합니다.

- `GET /v1/auth/github/callback?installation_id=...&state=...`
  - 서명된 상태와 상태에 인코딩된 관리자 ID를 검증합니다.
  - 업데이트 `github_installations`
  - 감사: `github.installation.connected`

- `POST /v1/workspaces/:key/github/sync-repos`
  - 인증: 작업공간 관리자+
  - 민트 단기 설치 토큰(저장되지 않음)
  - 접근 가능한 저장소를 가져오고 `github_repo_links`을 업데이트합니다.
  - 누락된 저장소를 비활성으로 표시합니다.
  - 감사: `github.repos.synced`

- `GET /v1/workspaces/:key/github/repos`
  - 인증자: 워크스페이스 멤버+
  - 캐시된 활성 저장소를 반환합니다(`full_name`, `private`, `default_branch`)

- `GET /v1/workspaces/:key/github/installation`
  - 인증자: 워크스페이스 멤버+
  - 관리 UI에 대한 연결 상태를 반환합니다.

## 보안 참고 사항

- 설치 액세스 토큰은 수명이 짧으며 지속되지 않습니다.
- 콜백 상태는 서명되어 있으며 시간이 제한되어 있습니다.
- 콜백은 상태의 행위자가 여전히 작업 공간 관리자/소유자인지 확인합니다.
- 개인 키는 서버 측에서만 가능합니다.