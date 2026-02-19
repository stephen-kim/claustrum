# 发布闸门

Release Gate 会在发布前一次性跑完高风险 QC 检查。

## 执行方式

```bash
RELEASE_GATE_RESET_DB=true ./scripts/release-gate.sh
```

## 关键环境变量

- `BASE_URL`（默认 `http://localhost:8080`）
- `RELEASE_GATE_RESET_DB`（默认 `false`）
- `RELEASE_GATE_TIMEOUT_SEC`（默认 `180`）
- `RELEASE_GATE_COMPOSE_FILE`（默认 `docker-compose.dev.yml`）
- `RELEASE_GATE_COMPOSE_PROFILE`（默认 `localdb`）

## 执行顺序

1. `pnpm lint`
2. `pnpm test`
3. `docker compose up -d`（需要时 `down -v`）
4. `scripts/qc/bootstrap.sh`
5. `scripts/qc/isolation.sh`
6. `scripts/qc/rbac.sh`
7. `scripts/qc/webhooks.sh`
8. `scripts/qc/secrets.sh`

任一项失败即 `exit 1`。

## 各脚本检查项

- `bootstrap.sh`: bootstrap admin / must_change_password gate
- `isolation.sh`: workspace 间隔离
- `rbac.sh`: reader/writer/maintainer 权限边界
- `webhooks.sh`: 签名校验与幂等
- `secrets.sh`: 秘密泄露模式扫描

最后更新: 2026-02-19
