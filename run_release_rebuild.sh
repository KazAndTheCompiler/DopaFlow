#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

ROOT="${DOPAFLOW_ROOT:-$(cd "$(dirname "$0")" && pwd)}"
RELEASE_DIR="${DOPAFLOW_RELEASE_DIR:-/tmp/dopaflow-release}"
BACKEND_RELEASE_DIR="$RELEASE_DIR/dopaflow-backend-v2"
BACKEND_BUILD_DIR="$ROOT/backend/dist/dopaflow-backend"
DESKTOP_BIN_NAME="dopaflow-desktop"
export DOPAFLOW_RELEASE_CHANNEL="${DOPAFLOW_RELEASE_CHANNEL:-dev}"
export DOPAFLOW_GITHUB_OWNER="${DOPAFLOW_GITHUB_OWNER:-KazAndTheCompiler}"
export DOPAFLOW_GITHUB_REPO="${DOPAFLOW_GITHUB_REPO:-dopaflow}"

NODE_BIN=""
for candidate in \
  "${DOPAFLOW_NODE_BIN:-}" \
  "/usr/local/bin/node" \
  "$(command -v node 2>/dev/null || true)"
do
  if [[ -n "${candidate:-}" && -x "$candidate" ]]; then
    NODE_BIN="$candidate"
    break
  fi
done

if [[ -z "$NODE_BIN" ]]; then
  echo "No usable node binary found." >&2
  exit 1
fi

NODE_DIR="$(dirname "$NODE_BIN")"
NPM_BIN="$NODE_DIR/npm"
VERSION="$("$NODE_BIN" -p "require('$ROOT/desktop/package.json').version")"
UNPACKED_DIR="$RELEASE_DIR/DopaFlow-$VERSION-linux-unpacked"
RUNTIME_STATE_DIR="$UNPACKED_DIR/runtime-state"
LAUNCH_LOG="$RUNTIME_STATE_DIR/launch.log"
PYINSTALLER_BIN="$ROOT/.venv/bin/pyinstaller"
ELECTRON_BUILDER_CLI="$ROOT/desktop/node_modules/electron-builder/out/cli/cli.js"
MODE="${1:-full}"
LDCONFIG_BIN="$(command -v ldconfig || true)"
if [[ -z "$LDCONFIG_BIN" ]]; then
  for candidate in /usr/sbin/ldconfig /sbin/ldconfig; do
    if [[ -x "$candidate" ]]; then
      LDCONFIG_BIN="$candidate"
      break
    fi
  done
fi

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

ensure_host_deps() {
  bash "$ROOT/install_electron_runtime_deps.sh"
}

have_runtime_lib() {
  local lib_name="$1"
  if [[ -n "$LDCONFIG_BIN" ]] && "$LDCONFIG_BIN" -p 2>/dev/null | grep -q "$lib_name"; then
    return 0
  fi
  if [[ -e "/usr/lib/x86_64-linux-gnu/$lib_name" || -e "/lib/x86_64-linux-gnu/$lib_name" ]]; then
    return 0
  fi
  if command -v dpkg-query >/dev/null 2>&1; then
    dpkg-query -L libnss3 libnspr4 2>/dev/null | grep -q "$lib_name"
    return $?
  fi
  return 1
}

ensure_runtime_deps() {
  local required_runtime_libs=(
    libnss3.so
    libnspr4.so
    libxcb-render.so.0
    libxcb-shm.so.0
    libXau.so.6
    libXdmcp.so.6
    libpixman-1.so.0
    libgraphite2.so.3
    libdatrie.so.1
    libwayland-client.so.0
    libwayland-cursor.so.0
    libwayland-egl.so.1
    libXcursor.so.1
    libXinerama.so.1
  )

  for lib_name in "${required_runtime_libs[@]}"; do
    if ! have_runtime_lib "$lib_name"; then
      echo "Installing missing Electron runtime dependency: $lib_name"
      ensure_host_deps
      return 0
    fi
  done

  return 0
}

ensure_desktop_build_deps() {
  if [[ ! -d "$ROOT/desktop/vendor-runtime/extract/usr/lib/x86_64-linux-gnu" ]]; then
    echo "Desktop vendor runtime extract missing; relying on host libraries."
  fi

  ensure_runtime_deps
}

build_frontend() {
  PATH="$NODE_DIR:$PATH" "$NPM_BIN" --prefix "$ROOT/frontend" run build
}

build_skinmaker() {
  PATH="$NODE_DIR:$PATH" "$NPM_BIN" --prefix "$ROOT/skinmaker" run build
}

build_backend() {
  if ! command -v objdump >/dev/null 2>&1; then
    echo "objdump missing; installing host deps first"
    ensure_host_deps
  fi
  "$PYINSTALLER_BIN" "$ROOT/backend/dopaflow-backend.spec" --distpath "$ROOT/backend/dist" --noconfirm
}

publish_backend_release() {
  rm -rf "$BACKEND_RELEASE_DIR"
  cp -a "$BACKEND_BUILD_DIR" "$BACKEND_RELEASE_DIR"
  mkdir -p "$BACKEND_RELEASE_DIR/shared"
  cp -a "$ROOT/shared/version.json" "$BACKEND_RELEASE_DIR/shared/version.json"
}

build_desktop() {
  ensure_desktop_build_deps
  (
    cd "$ROOT/desktop"
    PATH="$NODE_DIR:$PATH" \
      "$NODE_BIN" "$ELECTRON_BUILDER_CLI" --dir --linux
  )
}

install_release() {
  find "$RELEASE_DIR" -maxdepth 1 -mindepth 1 -type d -name 'DopaFlow-*-linux-unpacked' ! -name "DopaFlow-$VERSION-linux-unpacked" -exec rm -rf {} +
  rm -rf "$UNPACKED_DIR"
  cp -a "$ROOT/desktop/dist/linux-unpacked" "$UNPACKED_DIR"
  chmod +x "$UNPACKED_DIR/$DESKTOP_BIN_NAME"
  # Inject the locally-built backend (overrides any stub bundled at package time)
  if [[ -x "$BACKEND_BUILD_DIR/dopaflow-backend" ]]; then
    cp -a "$BACKEND_BUILD_DIR/." "$UNPACKED_DIR/resources/dopaflow-backend/"
    mkdir -p "$UNPACKED_DIR/resources/dopaflow-backend/shared"
    cp -a "$ROOT/shared/version.json" "$UNPACKED_DIR/resources/dopaflow-backend/shared/version.json"
  fi
}

launch_release() {
  ensure_runtime_deps
  cd "$UNPACKED_DIR"
  mkdir -p "$RUNTIME_STATE_DIR"
  : >"$LAUNCH_LOG"
  nohup env \
    PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    LD_LIBRARY_PATH="/lib/x86_64-linux-gnu:/usr/lib/x86_64-linux-gnu" \
    LIBVA_DRIVER_NAME=dummy \
    ELECTRON_DISABLE_GPU=1 \
    HOME="$HOME" \
    DISPLAY="${DISPLAY:-}" \
    WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-}" \
    XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-}" \
    XDG_SESSION_TYPE="${XDG_SESSION_TYPE:-}" \
    XDG_CURRENT_DESKTOP="${XDG_CURRENT_DESKTOP:-}" \
    DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-}" \
    SNAP="" SNAP_NAME="" SNAP_REVISION="" SNAP_ARCH="" \
    SNAP_COMMON="" SNAP_USER_COMMON="" SNAP_DATA="" \
    SNAP_USER_DATA="" SNAP_INSTANCE_NAME="" SNAP_INSTANCE_KEY="" \
    SNAP_REAL_HOME="" SNAP_CONTEXT="" \
    ./AppRun \
    --no-sandbox \
    --ozone-platform=x11 \
    --disable-gpu \
    --disable-software-rasterizer \
    --disable-dev-shm-usage \
    >"$LAUNCH_LOG" 2>&1 &
  local pid=$!
  echo "Launched DopaFlow (pid $pid)"
  echo "Logs: $LAUNCH_LOG"
}

main() {
  need_cmd cp
  need_cmd rm
  need_cmd chmod

  case "$MODE" in
    full)
      build_frontend
      build_skinmaker
      build_backend
      publish_backend_release
      build_desktop
      install_release
      launch_release
      ;;
    package-only)
      build_desktop
      install_release
      ;;
    install-only)
      install_release
      ;;
    launch-only)
      launch_release
      ;;
    *)
      echo "Usage: $0 [full|package-only|install-only|launch-only]" >&2
      exit 1
      ;;
  esac
}

main "$@"
