#!/usr/bin/env bash
# Dev start script — enables local-client trust so scope checks pass
# without needing OAuth tokens.  Run from the backend/ directory.
#
# Usage:  bash start_dev.sh
#         DB_PATH=/custom/path.db bash start_dev.sh

set -euo pipefail

export DOPAFLOW_TRUST_LOCAL_CLIENTS=1
export DOPAFLOW_DEV_AUTH="${DOPAFLOW_DEV_AUTH:-false}"
export DOPAFLOW_DB_PATH="${DOPAFLOW_DB_PATH:-$(python3 -c 'from app.core.config import default_db_path; print(default_db_path())')}"

echo "→  DB:    $DOPAFLOW_DB_PATH"
echo "→  Trust local clients: enabled"
echo "→  Dev auth bypass: $DOPAFLOW_DEV_AUTH"

exec python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
