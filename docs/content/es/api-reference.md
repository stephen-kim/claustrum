# Referencia de API

Usa el explorador interactivo:

- [Abrir API Explorer](/docs/api)

La página usa Scalar y carga `/openapi.json`.  
Ese spec se genera automáticamente desde `apps/memory-core/src/http/routes/**/*.ts` e incluye validaciones Zod en `req.body/query/params`.

## Notas

- La mayoría de endpoints requiere `Authorization: Bearer <api_key>`.
- Endpoints de sesión usados por Admin UI:
  - `/v1/auth/login`
  - `/v1/auth/me`
  - `/v1/auth/logout`
- Para reglas de acceso, revisa:
  - [Auth and Roles](auth-and-roles)
  - [Role Resolution Specification](role-resolution-spec)

Última actualización: 2026-02-19
