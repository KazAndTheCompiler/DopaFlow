#!/usr/bin/env bash
set -euo pipefail

TARGET_DATE="2026-04-08"

if [[ "$(date +%F)" != "$TARGET_DATE" ]]; then
  echo "Refusing to run: this keepalive script is only for $TARGET_DATE." >&2
  exit 1
fi

echo "Refreshing sudo credentials for $TARGET_DATE."
sudo -v

echo "Keeping sudo alive until midnight or until this process exits."
while true; do
  if [[ "$(date +%F)" != "$TARGET_DATE" ]]; then
    echo "Date changed; stopping sudo keepalive."
    exit 0
  fi
  sudo -n true
  sleep 60
done
