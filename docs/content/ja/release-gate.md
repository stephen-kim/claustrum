# リリースゲート

Release Gate は、リリース前に必須チェックをまとめて実行する QC ランナーです。

## 実行

```bash
RELEASE_GATE_RESET_DB=true ./scripts/release-gate.sh
```

## 主要環境変数

- `BASE_URL`（既定: `http://localhost:8080`）
- `RELEASE_GATE_RESET_DB`（既定: `false`）
- `RELEASE_GATE_TIMEOUT_SEC`（既定: `180`）
- `RELEASE_GATE_COMPOSE_FILE`（既定: `docker-compose.dev.yml`）
- `RELEASE_GATE_COMPOSE_PROFILE`（既定: `localdb`）

## 実行順序

1. `pnpm lint`
2. `pnpm test`
3. `docker compose up -d`（必要時 `down -v`）
4. `scripts/qc/bootstrap.sh`
5. `scripts/qc/isolation.sh`
6. `scripts/qc/rbac.sh`
7. `scripts/qc/webhooks.sh`
8. `scripts/qc/secrets.sh`

1つでも失敗したら `exit 1` で終了します。

## スクリプト別の検証内容

- `bootstrap.sh`: bootstrap admin / must_change_password ゲート
- `isolation.sh`: workspace 間隔離
- `rbac.sh`: reader/writer/maintainer 境界
- `webhooks.sh`: 署名検証と delivery 冪等性
- `secrets.sh`: 秘密情報漏えいパターン検査

最終更新: 2026-02-19
