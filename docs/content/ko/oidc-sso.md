# OIDC SSO

Claustrum은 공급자 관리 ID 및 역할 동기화를 통해 작업공간별로 OIDC 로그인을 지원합니다.

## 아이덴티티 모델

- 사용자 ID 키는 OIDC 클레임의 `(issuer + subject)`입니다.
- 이메일은 프로필 데이터로만 취급되며 변경될 수 있습니다.
- 신원 기록은 `user_identities`에 저장됩니다.

## 공급자 구성

관리 UI 경로:

- 작업공간 -> **SSO 설정(OIDC)**

제공자 필드:

- `issuer_url`
- `client_id`
- `client_secret`
- `claim_groups_name` (기본값: `groups`)
- `claim_groups_format` (`id` 권장)
- `scopes` (기본값: `openid profile email`)
- `enabled`

## 로그인 흐름

엔드포인트:

- `GET /v1/auth/oidc/:workspace_key/start`
- `GET /v1/auth/oidc/:workspace_key/callback`

흐름:

1. 시작 엔드포인트는 PKCE 챌린지 + 서명된 상태 토큰을 생성합니다.
2. 사용자는 IdP에서 인증합니다.
3. 콜백은 토큰에 대한 코드를 교환합니다.
4. `id_token` 서명은 IdP JWKS를 통해 확인됩니다.
5. `(issuer, sub)`이 `user_identities`으로 업데이트됩니다.
6. 워크스페이스/프로젝트 멤버십에 그룹 매핑이 적용됩니다.
7. 세션 토큰이 발급됩니다.

## 그룹 청구 형식

- `id`: IdP에서 제공하는 안정적인 그룹 ID(권장)
- `name`: 사람이 읽을 수 있는 이름입니다. IdP에서 이름을 바꾸면 매핑 동작이 중단될 수 있습니다.

## 공급자 예

### 옥타

- 발행자 : `https://<your-okta-domain>/oauth2/default`
- 범위: `openid profile email groups`
- 그룹 클레임: 종종 `groups`(인증 서버 클레임에서 구성)

### 마이크로소프트 엔트라 ID

- 발행자: `https://login.microsoftonline.com/<tenant-id>/v2.0`
- 범위: `openid profile email`
- 그룹 클레임: 그룹 ID에 대한 앱 매니페스트 구성(권장)

## 보안 참고 사항

- 이메일을 안정적인 ID 키로 사용하지 마세요.
- 가능하면 `claim_groups_format=id`을 사용하세요.
- 클라이언트 비밀을 순환하고 필수 리디렉션 URI로 제한합니다.