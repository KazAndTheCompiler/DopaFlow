#!/usr/bin/env bash
set -e

cd v2/backend

echo "[dopaflow] Installing PyInstaller..."
../../.venv/bin/pip install pyinstaller --quiet

echo "[dopaflow] Building backend..."
../../.venv/bin/pyinstaller dopaflow-backend.spec --distpath dist --workpath build --noconfirm

echo "[dopaflow] Done. Output: v2/backend/dist/dopaflow-backend"
echo "[dopaflow] Binary size: $(du -sh dist/dopaflow-backend | cut -f1)"
