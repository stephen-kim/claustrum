# API キーとセキュリティ

Claustrum の API キーは「1回だけ表示・DB にはハッシュのみ保存」が基本ルールです。

## セキュリティモデル

- 平文 API キーは DB に保存しません。
- DB には `api_keys.key_hash` のみ保存します。
- 管理者でも既存キーの平文は再表示できません。
- ユーザーは自分のキーを自分で発行できます。
- 管理者は revoke / reset ができます。
- reset は one-time view リンクで配布します（既定 TTL: 15 分）。

## 主要フロー

### 1) ユーザー自己発行
- `POST /v1/api-keys`
- レスポンスで平文キーを 1 回だけ返却します。

### 2) キー一覧
- `GET /v1/api-keys`（本人）
- `GET /v1/users/:userId/api-keys`（admin または本人）
- 返るのはメタデータのみで、平文は返しません。

### 3) Revoke
- `POST /v1/api-keys/:id/revoke`
- キー所有者または admin が実行できます。

### 4) Admin reset + one-time link
- `POST /v1/users/:userId/api-keys/reset`
- 対象ユーザーの有効キーを revoke し、新しいキーを作成します。
- 平文キーは直接返さず、one-time URL を返します。

### 5) One-time view
- `GET /v1/api-keys/one-time/:token`
- 1 回だけ有効、期限切れ / 再利用は `410 Gone`。

## 監査イベント

- `api_key.created`
- `api_key.revoked`
- `api_key.reset`
- `api_key.one_time_view`

## 運用のコツ

- 端末ごとに `device_label` を分ける
- 使っていないキーは早めに revoke
- 漏えいが疑われたら即 reset

最終更新: 2026-02-19
