#!/usr/bin/env bash
# Launch DopaFlow — run this from anywhere in the repo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
VERSION="$(node -p "require('$ROOT/desktop/package.json').version" 2>/dev/null || echo "unknown")"
RELEASE_DIR="${DOPAFLOW_RELEASE_DIR:-/tmp/dopaflow-release}"
UNPACKED="$RELEASE_DIR/DopaFlow-$VERSION-linux-unpacked"

# If the unpacked release doesn't exist, build it first.
if [[ ! -x "$UNPACKED/dopaflow-desktop" ]]; then
  echo "No installed build found for v$VERSION — running install (this takes a minute)..."
  bash "$ROOT/run_release_rebuild.sh" install-only 2>&1 || {
    echo "Install failed. Run 'bash run_release_rebuild.sh full' to do a full rebuild."
    exit 1
  }
fi

cd "$UNPACKED"
mkdir -p runtime-state
LOG="runtime-state/launch.log"
: >"$LOG"

nohup env \
  PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
  LD_LIBRARY_PATH="/lib/x86_64-linux-gnu:/usr/lib/x86_64-linux-gnu" \
  LIBVA_DRIVER_NAME=dummy \
  ELECTRON_DISABLE_GPU=1 \
  HOME="$HOME" \
  DISPLAY="${DISPLAY:-}" \
  XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-}" \
  XDG_CURRENT_DESKTOP="${XDG_CURRENT_DESKTOP:-}" \
  DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-}" \
  ./AppRun \
  --no-sandbox \
  --disable-gpu \
  --disable-gpu-sandbox \
  --disable-software-rasterizer \
  --disable-dev-shm-usage \
  --use-gl=egl \
  --in-process-gpu \
  >"$LOG" 2>&1 &

echo "DopaFlow v$VERSION launched (pid $!)"
echo "Logs: $UNPACKED/$LOG"
