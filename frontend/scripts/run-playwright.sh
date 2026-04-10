#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$FRONTEND_DIR/.." && pwd)"
RUNTIME_LIB_DIR="${DOPAFLOW_PLAYWRIGHT_LD_LIBRARY_PATH:-$REPO_ROOT/desktop/vendor-runtime/extract/usr/lib/x86_64-linux-gnu}"

if [[ -d "$RUNTIME_LIB_DIR" ]]; then
  if [[ -n "${LD_LIBRARY_PATH:-}" ]]; then
    export LD_LIBRARY_PATH="$RUNTIME_LIB_DIR:$LD_LIBRARY_PATH"
  else
    export LD_LIBRARY_PATH="$RUNTIME_LIB_DIR"
  fi
fi

exec npx --prefix "$FRONTEND_DIR" playwright "$@"
