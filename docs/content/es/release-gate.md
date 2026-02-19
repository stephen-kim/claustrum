# Release gate

Release Gate ejecuta, en una sola pasada, las validaciones de mayor riesgo antes de liberar cambios.

## Ejecución

```shell
RELEASE_GATE_RESET_DB=true ./scripts/release-gate.sh
```text

## Variables clave

- `BASE_URL` (default: `http://localhost:8080`)
- `RELEASE_GATE_RESET_DB` (default: `false`)
- `RELEASE_GATE_TIMEOUT_SEC` (default: `180`)
- `RELEASE_GATE_COMPOSE_FILE` (default: `docker-compose.dev.yml`)
- `RELEASE_GATE_COMPOSE_PROFILE` (default: `localdb`)

## Secuencia

1. `pnpm lint`
2. `pnpm test`
3. `docker compose up -d` (si corresponde, `down -v`)
4. `scripts/qc/bootstrap.sh`
5. `scripts/qc/isolation.sh`
6. `scripts/qc/rbac.sh`
7. `scripts/qc/webhooks.sh`
8. `scripts/qc/secrets.sh`

Si alguna validación falla, el script termina con `exit 1`.

## Qué valida cada script

- `bootstrap.sh`: bootstrap admin + gate de setup
- `isolation.sh`: aislamiento entre workspaces
- `rbac.sh`: límites reader/writer/maintainer
- `webhooks.sh`: firma e idempotencia
- `secrets.sh`: búsqueda de fugas de secretos
