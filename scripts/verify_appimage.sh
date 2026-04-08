#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/DopaFlow-*.AppImage" >&2
  exit 1
fi

APPIMAGE_PATH="$1"

if [[ ! -f "$APPIMAGE_PATH" ]]; then
  echo "AppImage not found: $APPIMAGE_PATH" >&2
  exit 1
fi

WORKDIR="$(mktemp -d /tmp/dopaflow-appimage-verify.XXXXXX)"
cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

echo "Extracting AppImage into $WORKDIR"
(
  cd "$WORKDIR"
  "$APPIMAGE_PATH" --appimage-extract >/dev/null
)

ROOT="$WORKDIR/squashfs-root"
APP_RUN="$ROOT/AppRun"
DESKTOP_BIN="$ROOT/dopaflow-desktop"

if [[ ! -x "$APP_RUN" || ! -x "$DESKTOP_BIN" ]]; then
  echo "Extracted AppImage is missing AppRun or dopaflow-desktop" >&2
  exit 1
fi

echo
echo "Checking packaged runtime linkage"
LDD_OUTPUT="$(LD_LIBRARY_PATH="$ROOT/usr/lib" ldd "$DESKTOP_BIN")"
printf '%s\n' "$LDD_OUTPUT"

if grep -q "not found" <<<"$LDD_OUTPUT"; then
  echo
  echo "Packaged dependency audit failed: one or more shared libraries are unresolved." >&2
  exit 1
fi

echo
echo "Packaged dependency audit passed."
echo "Next step: launch $APP_RUN on a real desktop session to verify GUI boot."
