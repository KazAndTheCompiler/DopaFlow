#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

PACKAGES=(
  binutils
  libnss3
  libnspr4
  libatk1.0-0t64
  libatk-bridge2.0-0t64
  libgtk-3-0t64
  libxss1
  libgbm1
  libasound2t64
)

APT_BIN="$(command -v apt-get || true)"
if [[ -z "$APT_BIN" ]]; then
  for candidate in /usr/bin/apt-get /bin/apt-get; do
    if [[ -x "$candidate" ]]; then
      APT_BIN="$candidate"
      break
    fi
  done
fi
if [[ -z "$APT_BIN" ]]; then
  echo "apt-get not found in PATH." >&2
  exit 1
fi

sudo "$APT_BIN" update
sudo "$APT_BIN" install -y "${PACKAGES[@]}"

have_lib() {
  local lib_name="$1"
  local ldconfig_bin=""
  ldconfig_bin="$(command -v ldconfig || true)"
  if [[ -z "$ldconfig_bin" ]]; then
    for candidate in /usr/sbin/ldconfig /sbin/ldconfig; do
      if [[ -x "$candidate" ]]; then
        ldconfig_bin="$candidate"
        break
      fi
    done
  fi
  if [[ -n "$ldconfig_bin" ]] && "$ldconfig_bin" -p 2>/dev/null | grep -q "$lib_name"; then
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

if ! have_lib "libnss3.so"; then
  echo "libnss3.so still missing after install." >&2
  exit 1
fi
if ! have_lib "libnspr4.so"; then
  echo "libnspr4.so still missing after install." >&2
  exit 1
fi

echo "Installed Electron runtime/build dependencies:"
printf ' - %s\n' "${PACKAGES[@]}"
