# 권한 부여 모델 개요

## 아키텍처 개요

Claustrum은 엄격한 작업 공간 격리를 시행합니다. 승인 결정은 작업 공간 경계를 넘지 않습니다.

- 작업공간 격리는 필수입니다.
- OIDC는 인증 및 작업 공간 진입 게이팅을 처리합니다.
- GitHub는 기본 프로젝트 수준 권한을 제공합니다.
- 수동 재정의는 감사된 예외 경로입니다.

### 제어 평면 흐름

```text
User
  |
  v
OIDC Login (Gate)
  |
  v
Workspace Membership Check
  |
  v
GitHub Permission Sync (Direct + Teams)
  |
  v
Manual Override Layer (Exception)
  |
  v
Effective Role Calculation
  |
  v
Project Access (Allow / Deny)
```
## 진실의 근원

> Claustrum은 GitHub를 프로젝트 수준 액세스를 위한 주요 정보 소스로 취급합니다.
> OIDC는 인증 및 작업 공간 액세스 확인을 처리합니다. 이는 프로젝트 수준 인증의 주요 소스가 아닙니다.

## 우선순위

승인은 다음 순서로 해결됩니다.

- `manual_override`
- `github_derived_role`
- `oidc_boost_role`
- `default_none`

정의:

- `manual_override`: 승인된 관리자가 생성한 명시적 예외입니다.
- `github_derived_role`: GitHub 직접 협력자 및 팀 권한에서 파생된 역할입니다.
- `oidc_boost_role`: 정책이 허용하는 경우 OIDC 그룹 매핑에서 역할이 증가합니다.
- `default_none` : 접근이 불가능합니다.

## 예시 시나리오

### 1) GitHub 쓰기 + OIDC 그룹 없음

- OIDC 게이트를 통과합니다.
- GitHub는 `write`을 계산합니다.
- 효과적인 프로젝트 역할은 `writer`이 됩니다.
- 접근이 허용됩니다.

### 2) GitHub 읽기 + OIDC 관리자 그룹

- OIDC 게이트를 통과합니다.
- GitHub는 `read`을 계산합니다.
- OIDC 매핑은 정책별로 역할을 강화합니다.
- 효과적인 역할은 GitHub 및 OIDC 부스트의 최대치입니다.

### 3) 수동 오버라이드 적용

- OIDC 게이트를 통과합니다.
- 수동 오버라이드는 긴급 사고 작업을 위해 `maintainer`을 설정합니다.
- 효과적인 역할은 재정의를 따릅니다.
- 재정의는 감사를 거쳐 임시 정책 예외로 처리됩니다.

### 4) OIDC 접근 확인 실패

- 인증에 실패하거나 작업장 게이트 확인에 실패합니다.
- GitHub 파생 역할은 액세스 권한 부여에 대해 평가되지 않습니다.
- 접근이 거부되었습니다.

### 5) GitHub에서 팀 멤버십이 제거되었습니다.

- 웹훅 이벤트가 도착했습니다.
- 영향을 받은 리포지토리에 대해 부분 재계산이 실행됩니다.
- 동기화 모드 및 보호 규칙에 따라 역할이 축소되거나 제거됩니다.

## 운영규칙

- 작업공간 관리자/소유자 재정의는 제어된 작업에 계속 사용할 수 있습니다.
- 소유자 보호 규칙은 자동 제거 중에 우발적인 소유자 손실을 방지합니다.
- 모든 민감한 전환은 감사 로그에 표시되어야 합니다.
