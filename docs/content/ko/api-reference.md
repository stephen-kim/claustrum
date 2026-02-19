# API 참조

대화형 API 탐색기를 사용하세요.

- [API 탐색기 열기](/docs/api)

Scalar로 구동되며 `/openapi.json`에서 OpenAPI 사양을 읽습니다.
해당 사양은 `apps/memory-core/src/http/routes/**/*.ts`(인라인 Zod `req.body/query/params` 구문 분석 포함)에서 자동으로 생성됩니다.

참고:

- 대부분의 엔드포인트에는 `Authorization: Bearer <api_key>`이 필요합니다.
- 세션 엔드포인트(`/v1/auth/login`, `/v1/auth/me`, `/v1/auth/logout`)는 관리 UI에서 사용됩니다.
- 액세스 제어 동작은 [인증 및 역할](auth-and-roles) 및 [역할 해결 사양](role-resolution-spec)에 문서화되어 있습니다.