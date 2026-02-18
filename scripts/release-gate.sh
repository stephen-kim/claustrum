#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QC_DIR="${ROOT_DIR}/scripts/qc"

export BASE_URL="${BASE_URL:-http://localhost:8080}"
export RELEASE_GATE_TIMEOUT_SEC="${RELEASE_GATE_TIMEOUT_SEC:-180}"
export RELEASE_GATE_RESET_DB="${RELEASE_GATE_RESET_DB:-false}"
export RELEASE_GATE_WORK_DIR="${RELEASE_GATE_WORK_DIR:-${ROOT_DIR}/.release-gate}"
export RELEASE_GATE_COMPOSE_FILE="${RELEASE_GATE_COMPOSE_FILE:-docker-compose.dev.yml}"
export RELEASE_GATE_COMPOSE_PROFILE="${RELEASE_GATE_COMPOSE_PROFILE:-localdb}"
export RELEASE_GATE_SKIP_PRECHECKS="${RELEASE_GATE_SKIP_PRECHECKS:-false}"

# Local defaults for non-interactive QC runs.
export DATABASE_URL="${DATABASE_URL:-postgres://claustrum:claustrum@postgres:5432/claustrum}"
export POSTGRES_DB="${POSTGRES_DB:-claustrum}"
export POSTGRES_USER="${POSTGRES_USER:-claustrum}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-claustrum}"
export MEMORY_CORE_API_KEY="${MEMORY_CORE_API_KEY:-release-gate-api-key}"
export MEMORY_CORE_SEED_ADMIN_KEY="${MEMORY_CORE_SEED_ADMIN_KEY:-release-gate-seed-admin-key}"
export MEMORY_CORE_RUN_SEED="${MEMORY_CORE_RUN_SEED:-false}"
export NEXT_PUBLIC_MEMORY_CORE_URL="${NEXT_PUBLIC_MEMORY_CORE_URL:-http://localhost:8080}"

# Ensure webhook idempotency test has a deterministic signing secret.
export GITHUB_APP_WEBHOOK_SECRET="${GITHUB_APP_WEBHOOK_SECRET:-release-gate-webhook-secret}"

# shellcheck disable=SC1091
source "${QC_DIR}/lib.sh"

run_step() {
  local name="${1}"
  shift
  log_info "==> ${name}"
  "$@"
}

dc() {
  docker compose -f "${RELEASE_GATE_COMPOSE_FILE}" --profile "${RELEASE_GATE_COMPOSE_PROFILE}" "$@"
}

cleanup() {
  log_info "Stopping docker compose stack"
  (cd "${ROOT_DIR}" && dc down >/dev/null 2>&1 || true)
}

trap cleanup EXIT

cd "${ROOT_DIR}"
mkdir -p "${RELEASE_GATE_WORK_DIR}"
rm -f "${STATE_FILE}"
touch "${STATE_FILE}"
chmod 600 "${STATE_FILE}" || true

if [[ "${RELEASE_GATE_SKIP_PRECHECKS}" != "true" ]]; then
  run_step "pnpm lint" pnpm lint
  run_step "pnpm test" pnpm test
fi

if [[ "${RELEASE_GATE_RESET_DB}" == "true" ]]; then
  run_step "docker compose down -v (reset db)" dc down -v --remove-orphans
fi

run_step "docker compose up -d" dc up -d

run_step "QC bootstrap" "${QC_DIR}/bootstrap.sh"
run_step "QC isolation" "${QC_DIR}/isolation.sh"
run_step "QC rbac" "${QC_DIR}/rbac.sh"
run_step "QC webhooks" "${QC_DIR}/webhooks.sh"
run_step "QC secrets" "${QC_DIR}/secrets.sh"

printf '\n[PASS] Release gate completed successfully.\n'
printf 'BASE_URL=%s\n' "${BASE_URL}"
printf 'RELEASE_GATE_RESET_DB=%s\n' "${RELEASE_GATE_RESET_DB}"
printf 'RELEASE_GATE_TIMEOUT_SEC=%s\n' "${RELEASE_GATE_TIMEOUT_SEC}"
printf 'RELEASE_GATE_COMPOSE_FILE=%s\n' "${RELEASE_GATE_COMPOSE_FILE}"
printf 'RELEASE_GATE_COMPOSE_PROFILE=%s\n' "${RELEASE_GATE_COMPOSE_PROFILE}"
printf 'RELEASE_GATE_SKIP_PRECHECKS=%s\n' "${RELEASE_GATE_SKIP_PRECHECKS}"
