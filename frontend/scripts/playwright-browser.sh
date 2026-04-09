#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNTIME_LIB_DIR="${DOPAFLOW_PLAYWRIGHT_LD_LIBRARY_PATH:-$REPO_ROOT/desktop/vendor-runtime/extract/usr/lib/x86_64-linux-gnu}"
REAL_BROWSER="${DOPAFLOW_PLAYWRIGHT_REAL_CHROMIUM:-}"
FALLBACK_LIB_DIRS=(
  "$RUNTIME_LIB_DIR"
  "$REPO_ROOT/desktop/dist/linux-unpacked/usr/lib"
  "/lib/x86_64-linux-gnu"
  "/usr/lib/x86_64-linux-gnu"
  "/var/lib/snapd/lib/gl"
  "/var/lib/snapd/lib/gl32"
  "/snap/codex/current/usr/lib"
  "/snap/codex/current/usr/lib/x86_64-linux-gnu"
  "/snap/codex/34/usr/lib"
  "/snap/codex/34/usr/lib/x86_64-linux-gnu"
)

if [[ -z "$REAL_BROWSER" ]]; then
  echo "DOPAFLOW_PLAYWRIGHT_REAL_CHROMIUM is required" >&2
  exit 1
fi

LIB_PATH_PARTS=()
for candidate in "${FALLBACK_LIB_DIRS[@]}"; do
  if [[ -d "$candidate" ]]; then
    LIB_PATH_PARTS+=("$candidate")
  fi
done

if [[ -n "${LD_LIBRARY_PATH:-}" ]]; then
  LIB_PATH_PARTS+=("$LD_LIBRARY_PATH")
fi

if [[ ${#LIB_PATH_PARTS[@]} -gt 0 ]]; then
  export LD_LIBRARY_PATH="$(IFS=:; echo "${LIB_PATH_PARTS[*]}")"
fi

exec "$REAL_BROWSER" "$@"
