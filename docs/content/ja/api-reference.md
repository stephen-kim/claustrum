# API リファレンス

インタラクティブな API ドキュメントはこちらです。

- [API Explorer を開く](/docs/api)

このページは Scalar を使って `/openapi.json` を表示します。  
OpenAPI は `apps/memory-core/src/http/routes/**/*.ts` から自動生成され、インラインの Zod バリデーションも反映されます。

## 補足

- 多くの API は `Authorization: Bearer <api_key>` が必要です。
- Admin UI のセッション API:
  - `/v1/auth/login`
  - `/v1/auth/me`
  - `/v1/auth/logout`
- 権限制御の仕様は以下を参照してください。
  - [Auth and Roles](auth-and-roles)
  - [Role Resolution Specification](role-resolution-spec)

最終更新: 2026-02-19
