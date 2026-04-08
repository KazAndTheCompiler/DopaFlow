#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/henry/vscode/build/dopaflow"
FRONTEND_DIR="$ROOT/frontend"
BACKEND_RELEASE_DIR="$ROOT/release/dopaflow-backend-v2"
RELEASE_ROOT="${1:-/home/henry/release/DopaFlow-2.0.7-web}"
RELEASE_FRONTEND_DIR="$RELEASE_ROOT/frontend"
STATE_DIR="$RELEASE_ROOT/runtime-state"
BACKEND_LOG="$STATE_DIR/backend.log"
FRONTEND_LOG="$STATE_DIR/frontend.log"

export PATH="/home/henry/vscode/.codex-bin:$PATH"

mkdir -p "$RELEASE_FRONTEND_DIR" "$STATE_DIR"

echo "==> frontend build"
( cd "$FRONTEND_DIR" && VITE_API_URL="http://127.0.0.1:8000/api/v2" npm run build )

echo "==> install frontend"
find "$RELEASE_FRONTEND_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a "$FRONTEND_DIR/dist/." "$RELEASE_FRONTEND_DIR/"

echo "==> install backend"
rm -rf "$RELEASE_ROOT/dopaflow-backend-v2"
cp -a "$BACKEND_RELEASE_DIR" "$RELEASE_ROOT/dopaflow-backend-v2"

cp -a "$ROOT/scripts/release_web/serve_release.py" "$RELEASE_ROOT/serve_release.py"

cat >"$RELEASE_ROOT/start.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT/dopaflow-backend-v2"
FRONTEND_DIR="$ROOT/frontend"
STATE_DIR="$ROOT/runtime-state"
BACKEND_LOG="$STATE_DIR/backend.log"
FRONTEND_LOG="$STATE_DIR/frontend.log"
BACKEND_PID_FILE="$STATE_DIR/backend.pid"
FRONTEND_PID_FILE="$STATE_DIR/frontend.pid"

mkdir -p "$STATE_DIR"

if [[ -f "$BACKEND_PID_FILE" ]] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
  echo "Backend already running on pid $(cat "$BACKEND_PID_FILE")"
else
  (
    cd "$BACKEND_DIR"
    nohup env \
      DOPAFLOW_DEV_AUTH=1 \
      DOPAFLOW_TRUST_LOCAL_CLIENTS=1 \
      DOPAFLOW_EXTRA_CORS_ORIGINS="http://127.0.0.1:8001" \
      DOPAFLOW_BASE_URL="http://127.0.0.1:8001" \
      ./dopaflow-backend \
      >"$BACKEND_LOG" 2>&1 &
    echo $! >"$BACKEND_PID_FILE"
  )
fi

if [[ -f "$FRONTEND_PID_FILE" ]] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
  echo "Frontend release server already running on pid $(cat "$FRONTEND_PID_FILE")"
else
  (
    cd "$ROOT"
    nohup python3 "$ROOT/serve_release.py" --host 127.0.0.1 --port 8001 --dir "$FRONTEND_DIR" \
      >"$FRONTEND_LOG" 2>&1 &
    echo $! >"$FRONTEND_PID_FILE"
  )
fi

echo "Backend log: $BACKEND_LOG"
echo "Frontend log: $FRONTEND_LOG"
echo "App: http://127.0.0.1:8001"
EOF

cat >"$RELEASE_ROOT/stop.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
STATE_DIR="$ROOT/runtime-state"

stop_pid_file() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi
  local pid
  pid="$(cat "$pid_file")"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$pid_file"
}

stop_pid_file "$STATE_DIR/frontend.pid"
stop_pid_file "$STATE_DIR/backend.pid"

echo "Stopped DopaFlow web release."
EOF

chmod +x "$RELEASE_ROOT/start.sh" "$RELEASE_ROOT/stop.sh" "$RELEASE_ROOT/serve_release.py"

echo "Installed DopaFlow web release into $RELEASE_ROOT"
