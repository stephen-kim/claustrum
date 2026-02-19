# API Reference

Use the interactive API explorer:

- [Open API Explorer](/docs/api)

It is powered by Scalar and reads the OpenAPI spec at `/openapi.json`.
That spec is generated automatically from `apps/memory-core/src/http/routes/**/*.ts` (including inline Zod `req.body/query/params` parsing).

Notes:

- Most endpoints require `Authorization: Bearer <api_key>`.
- Session endpoints (`/v1/auth/login`, `/v1/auth/me`, `/v1/auth/logout`) are used by Admin UI.
- Access control behavior is documented in [Auth and Roles](auth-and-roles) and [Role Resolution Specification](role-resolution-spec).
