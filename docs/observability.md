# Observability

## What's already instrumented

### Backend structured logs

The backend emits structured JSON logs when packaged (`DOPAFLOW_PACKAGED=1`):

```json
{
  "timestamp": "2026-04-13T10:00:00+0000",
  "level": "WARNING",
  "logger": "dopaflow.slow_requests",
  "message": "...",
  "event": "slow_request",
  "request_id": "abc123",
  "path": "/api/v2/tasks",
  "method": "GET",
  "client_host": "127.0.0.1",
  "duration_ms": 234.5,
  "status": 200
}
```

In dev mode, logs are human-readable:

```
2026-04-13 10:00:00 WARNING [dopaflow.slow_requests] slow request: GET /api/v2/tasks 234.5ms
```

### Request tracing

Every API response includes an `X-Request-ID` header. Slow requests (>200ms) are logged with full context. Request errors are logged with exception details.

### Slow request threshold

Configured in `app/middleware/request_log.py`:
- `SLOW_THRESHOLD_MS = 200` — requests exceeding this are logged as JSON

### Health endpoints

| Endpoint | Purpose |
|---|---|
| `GET /health` | Full health with version, DB status |
| `GET /health/live` | Liveness probe (always returns `{"status":"ok"}`) |
| `GET /health/ready` | Readiness probe (checks DB connectivity) |

### Startup failure logging

If the database is unreachable at startup, the backend logs `CRITICAL Database unreachable at startup` and exits with `RuntimeError`.

### What is NOT yet wired (intentionally out of scope)

- **Distributed tracing** (OpenTelemetry) — would require an external collector; single-instance desktop app does not need this
- **Metrics dashboards** — would require Prometheus/DataDog; not appropriate for a local-first desktop app
- **Structured error tracking (Sentry)** — optional, see below

## Optional: Sentry integration

To enable Sentry error tracking in the backend:

```bash
pip install sentry-sdk
```

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastAPIIntegration

sentry_sdk.init(
    dsn="https://your-dsn@sentry.io/project",
    integrations=[FastAPIIntegration()],
    environment="production",  # or "development"
    send_default_pii=False,  # never send user-identifying data
)
```

Sentry is intentionally **not bundled** — it requires an account and adds a network dependency. Only enable it if you are comfortable with cloud coupling for error tracking.

## Where to look when something breaks

| Problem | Where to look |
|---|---|
| Backend won't start | `app/main.py` lifespan — checks DB connectivity first |
| Packaged app can't reach backend | Desktop main process stdout; `localhost:8000` connectivity |
| Slow requests | `dopaflow.slow_requests` log entries (JSON in packaged builds) |
| Auth rejections | `app/middleware/auth.py` — check `DOPAFLOW_TRUST_LOCAL_CLIENTS` and `DOPAFLOW_DEV_AUTH` |
| Migration failures | `_migrations` table in SQLite; `backend/migrations/` SQL files |
| Playwright E2E fails in CI | Check if backend artifact was downloaded correctly in `release.yml` |
