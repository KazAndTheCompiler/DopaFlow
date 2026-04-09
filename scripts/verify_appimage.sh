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

mapfile -t UNRESOLVED_LIBS < <(grep "not found" <<<"$LDD_OUTPUT" | awk '{print $1}')
KNOWN_HOST_FALLBACK_LIBS=(
  "libXau.so.6"
  "libXdmcp.so.6"
  "libxcb-render.so.0"
  "libxcb-shm.so.0"
  "libpixman-1.so.0"
  "libwayland-client.so.0"
  "libwayland-cursor.so.0"
  "libwayland-egl.so.1"
  "libXcursor.so.1"
  "libXinerama.so.1"
  "libgraphite2.so.3"
  "libdatrie.so.1"
)

declare -a UNEXPECTED_UNRESOLVED=()
declare -a EXPECTED_HOST_FALLBACKS=()

for lib in "${UNRESOLVED_LIBS[@]:-}"; do
  if printf '%s\n' "${KNOWN_HOST_FALLBACK_LIBS[@]}" | grep -qx "$lib"; then
    EXPECTED_HOST_FALLBACKS+=("$lib")
  else
    UNEXPECTED_UNRESOLVED+=("$lib")
  fi
done

if [[ ${#EXPECTED_HOST_FALLBACKS[@]} -gt 0 ]]; then
  echo
  echo "Known host fallback libraries were unresolved inside the payload:"
  printf ' - %s\n' "${EXPECTED_HOST_FALLBACKS[@]}"
fi

if [[ ${#UNEXPECTED_UNRESOLVED[@]} -gt 0 ]]; then
  echo
  echo "Packaged dependency audit failed: unexpected shared libraries are unresolved." >&2
  printf ' - %s\n' "${UNEXPECTED_UNRESOLVED[@]}" >&2
  exit 1
fi

echo
echo "Packaged dependency audit passed."
echo "Next step: launch $APP_RUN on a real desktop session to verify GUI boot."
