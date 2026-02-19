# API 参考

使用交互式 API 文档：

- [打开 API Explorer](/docs/api)

页面由 Scalar 渲染并读取 `/openapi.json`。  
OpenAPI 会从 `apps/memory-core/src/http/routes/**/*.ts` 自动生成，并包含内联 Zod `req.body/query/params` 校验定义。

## 说明

- 大多数接口需要 `Authorization: Bearer <api_key>`。
- Admin UI 使用的会话接口：
  - `/v1/auth/login`
  - `/v1/auth/me`
  - `/v1/auth/logout`
- 权限相关规范见：
  - [Auth and Roles](auth-and-roles)
  - [Role Resolution Specification](role-resolution-spec)

最后更新: 2026-02-19
