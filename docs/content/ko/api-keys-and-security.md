# API 키 및 보안

Claustrum은 팀 온보딩 및 서비스 액세스를 위해 사용자 범위 API 키를 사용합니다.

## 보안 모델

- API 키 일반 텍스트는 데이터베이스에 저장되지 않습니다.
- `api_keys.key_hash`만 저장됩니다(서버 비밀번호가 포함된 HMAC-SHA256).
- 관리자는 기존 일반 텍스트 키를 검색할 수 없습니다.
- 사용자는 자신의 키를 생성합니다.
- 관리자는 키를 취소하고 강제로 재설정할 수 있습니다.
- 재설정하면 일회성 보기 링크가 반환됩니다(기본적으로 TTL 15분).

## API 흐름

### 1) 자체 발급 키

- `POST /v1/api-keys`
- 본문: `{ "label": "my-laptop" }` (선택적 라벨)
- 응답에 일반 텍스트가 한 번 포함됩니다.
  - `{ "id": "...", "label": "...", "api_key": "clst_..." }`

### 2) 목록 키(메타데이터만 해당)

- `GET /v1/api-keys` (본인)
- `GET /v1/users/:userId/api-keys` (관리자/자신)
- 일반 텍스트는 반환되지 않습니다.

### 3) 키 취소

- `POST /v1/api-keys/:id/revoke`
- 키 소유자 또는 관리자에게 허용됩니다.

### 4) 관리자 재설정 + 일회성 링크

- `POST /v1/users/:userId/api-keys/reset`
- 대상 사용자의 모든 활성 키가 취소됩니다.
- 새로운 키가 생성됩니다.
- 일반 텍스트는 직접 반환되지 않습니다.
- 응답:
  - `{ "one_time_url": "...", "expires_at": "..." }`

### 5) 일회성 보기 엔드포인트

- `GET /v1/api-keys/one-time/:token`
- 한 번만 유효합니다.
- TTL 이후 만료
- 재사용/만료된 토큰은 `410 Gone`을 반환합니다.

## 감사 이벤트

Claustrum은 키에 민감한 작업에 대한 감사 로그를 작성합니다.

- `api_key.created`
- `api_key.revoked`
- `api_key.reset`
- `api_key.one_time_view`

## 운영 권장 사항

- 강력한 비밀을 설정하세요:
  - `MEMORY_CORE_API_KEY_HASH_SECRET`
  - `MEMORY_CORE_ONE_TIME_TOKEN_SECRET`
- 일회성 토큰 TTL을 짧게 유지하세요(`MEMORY_CORE_ONE_TIME_TOKEN_TTL_SECONDS`, 기본값 900).
- 일회성 링크를 공유할 때 공개 기본 URL에 HTTPS를 사용합니다.
- 취소/재설정을 통해 손상된 키를 즉시 순환합니다.