#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WIKI_SOURCE_DIR="${REPO_ROOT}/docs/wiki"

DEFAULT_MESSAGE="docs(wiki): sync from docs/wiki"
COMMIT_MESSAGE="${DEFAULT_MESSAGE}"
WIKI_URL=""
KEEP_TEMP=0

usage() {
  cat <<'EOF'
Usage: scripts/sync-wiki.sh [options]

Sync docs/wiki into the GitHub Wiki repository and push changes.

Options:
  --wiki-url <url>     Explicit wiki git URL (ex: https://github.com/owner/repo.wiki.git)
  --message <message>  Commit message (default: docs(wiki): sync from docs/wiki)
  --keep-temp          Keep the temp wiki clone directory (for debugging)
  -h, --help           Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wiki-url)
      WIKI_URL="${2:-}"
      shift 2
      ;;
    --message)
      COMMIT_MESSAGE="${2:-}"
      shift 2
      ;;
    --keep-temp)
      KEEP_TEMP=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "${WIKI_SOURCE_DIR}" ]]; then
  echo "Missing wiki source directory: ${WIKI_SOURCE_DIR}" >&2
  exit 1
fi

if [[ -z "${WIKI_URL}" ]]; then
  ORIGIN_URL="$(git -C "${REPO_ROOT}" remote get-url origin 2>/dev/null || true)"
  if [[ -z "${ORIGIN_URL}" ]]; then
    echo "Cannot determine origin URL. Use --wiki-url <url>." >&2
    exit 1
  fi

  if [[ "${ORIGIN_URL}" =~ ^https://github\.com/([^/]+)/([^/.]+)(\.git)?$ ]]; then
    WIKI_URL="https://github.com/${BASH_REMATCH[1]}/${BASH_REMATCH[2]}.wiki.git"
  elif [[ "${ORIGIN_URL}" =~ ^git@github\.com:([^/]+)/([^/.]+)(\.git)?$ ]]; then
    WIKI_URL="git@github.com:${BASH_REMATCH[1]}/${BASH_REMATCH[2]}.wiki.git"
  else
    echo "Unsupported origin URL format: ${ORIGIN_URL}" >&2
    echo "Use --wiki-url <url> to set wiki repository explicitly." >&2
    exit 1
  fi
fi

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/claustrum-wiki.XXXXXX")"

cleanup() {
  if [[ ${KEEP_TEMP} -eq 0 ]]; then
    rm -rf "${TMP_DIR}"
  else
    echo "Temp wiki clone kept at: ${TMP_DIR}" >&2
  fi
}
trap cleanup EXIT

echo "Cloning wiki repository: ${WIKI_URL}" >&2
git clone "${WIKI_URL}" "${TMP_DIR}" >/dev/null

echo "Syncing files from ${WIKI_SOURCE_DIR}" >&2
rsync -a --delete --exclude ".git" "${WIKI_SOURCE_DIR}/" "${TMP_DIR}/"

git -C "${TMP_DIR}" add -A

if git -C "${TMP_DIR}" diff --cached --quiet; then
  echo "No wiki changes to push." >&2
  exit 0
fi

TARGET_BRANCH="$(git -C "${TMP_DIR}" rev-parse --abbrev-ref HEAD)"
if [[ -z "${TARGET_BRANCH}" || "${TARGET_BRANCH}" == "HEAD" ]]; then
  TARGET_BRANCH="master"
fi

git -C "${TMP_DIR}" commit -m "${COMMIT_MESSAGE}" >/dev/null
git -C "${TMP_DIR}" push origin "HEAD:${TARGET_BRANCH}" >/dev/null

echo "Wiki sync pushed to ${TARGET_BRANCH}." >&2
