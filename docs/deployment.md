# DopaFlow Deployment Guide

## Quick Start — Docker Compose

```bash
# 1. Clone the repo
git clone https://github.com/KazAndTheCompiler/DopaFlow.git
cd DopaFlow

# 2. Configure environment
cp .env.example .env
# Edit .env with your production values

# 3. Start the application
docker compose up -d

# 4. Verify
curl http://localhost:3000/health   # Frontend
curl http://localhost:8000/health   # Backend
```

The app will be available at **http://localhost:3000**.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    nginx (port 3000)                │
│  ┌─────────────────┐    ┌────────────────────────┐ │
│  │  Static files   │    │  /api/* → backend:8000 │ │
│  │  (frontend SPA) │    │  (proxy, strips /api)  │ │
│  └─────────────────┘    └────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌────────────────────────┐
              │  FastAPI (port 8000)  │
              │  - uvicorn             │
              │  - SQLite at /data     │
              │  - APScheduler jobs    │
              └────────────────────────┘
```

The frontend nginx container proxies `/api/*` to the backend, so the frontend only needs to know relative paths (`/api/v2`).

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DOPAFLOW_DB_PATH` | `/data/dopaflow.db` | SQLite database path |
| `DOPAFLOW_DEV_AUTH` | `false` | Enable dev auth bypass |
| `DOPAFLOW_ENFORCE_AUTH` | `false` | Require API key for all requests |
| `DOPAFLOW_API_KEY` | _(none)_ | API key for authenticated requests |
| `DOPAFLOW_AUTH_TOKEN_SECRET` | _(none)_ | Secret for signed JWT tokens (32+ chars) |
| `DOPAFLOW_AUTH_TOKEN_ISSUER` | `dopaflow` | JWT token issuer |
| `DOPAFLOW_BASE_URL` | `http://localhost:8000` | Public base URL |
| `DOPAFLOW_ALLOW_LOCAL_WEBHOOK_TARGETS` | `false` | Allow localhost webhook targets |
| `DOPAFLOW_DISABLE_LOCAL_AUDIO` | `false` | Disable TTS/audio features |
| `DOPAFLOW_DISABLE_BACKGROUND_JOBS` | `false` | Disable APScheduler background tasks |
| `DOPAFLOW_JOURNAL_BACKUP_DIR` | _(auto)_ | Journal backup directory |
| `DOPAFLOW_TURSO_URL` | _(none)_ | Turso database URL (replaces SQLite) |
| `DOPAFLOW_TURSO_TOKEN` | _(none)_ | Turso auth token |
| `DOPAFLOW_GOOGLE_CLIENT_ID` | _(none)_ | Google OAuth client ID |
| `DOPAFLOW_GOOGLE_CLIENT_SECRET` | _(none)_ | Google OAuth client secret |

---

## Production Checklist

### Before Going Live

- [ ] Set `DOPAFLOW_ENFORCE_AUTH=true`
- [ ] Set a strong `DOPAFLOW_API_KEY` (use `openssl rand -hex 32`)
- [ ] Set `DOPAFLOW_AUTH_TOKEN_SECRET` to a random 32+ character string
- [ ] Set `DOPAFLOW_BASE_URL` to your public domain
- [ ] Review `DOPAFLOW_ALLOW_LOCAL_WEBHOOK_TARGETS=false` (default: already safe)
- [ ] Ensure `DOPAFLOW_DISABLE_BACKGROUND_JOBS=false` for alarm/scheduler features
- [ ] Mount a persistent volume for `/data` (database + backups)
- [ ] Configure external CORS origins if serving from a domain other than the backend

### Database Backups

Journal backups are written to `DOPAFLOW_JOURNAL_BACKUP_DIR` by the background scheduler. SQLite database can be backed up by copying `/data/dopaflow.db`.

### Database Migrations

Migrations run automatically on app startup via `run_migrations()`. Drift detection raises a `RuntimeError` and blocks startup if a previously-applied migration file has been modified.

### Staging Environment

For testing new versions or configuration changes before applying them to production:

```bash
# Build staging images (from production build)
docker build -f Dockerfile.backend -t dopaflow-backend:latest .
docker build -f Dockerfile.frontend -t dopaflow-frontend:latest .

# Start staging (uses ports 3001/8001, separate volume, jobs disabled)
docker compose -f docker-compose.staging.yml up -d

# Verify staging is running
curl http://localhost:8001/health/live   # Backend
curl http://localhost:3001/              # Frontend

# Test backup restoration before applying to production
python3 scripts/test_backup_restore.py

# When done, tear down staging
docker compose -f docker-compose.staging.yml down -v
```

Staging uses isolated ports (3001/8001) and a separate database volume so it does not interfere with the production instance. Background jobs are disabled to avoid conflicts.

### Backup and Restore

Verify your backup strategy works before relying on it:

```bash
python3 scripts/test_backup_restore.py
```

For production backups, copy the SQLite database file:
```bash
# Stop the container or use sqlite3 online backup to avoid inconsistency
docker compose exec backend apk add sqlite && \
docker compose exec backend sqlite3 /data/dopaflow.db ".backup '/tmp/dopaflow.db'" && \
docker compose cp backend:/tmp/dopaflow.db ./dopaflow-backup-$(date +%Y%m%d).db
```

---

## Production Mode Notes

- **SQLite**: Works well for single-instance deployments. Not suitable for multi-node horizontal scaling.
- **Turso**: For distributed deployments, set `DOPAFLOW_TURSO_URL` and `DOPAFLOW_TURSO_TOKEN` to use Turso cloud DB instead of local SQLite.
- **Auth**: By default (`ENFORCE_AUTH=false`), the backend is open. Set `ENFORCE_AUTH=true` and provide an `API_KEY` to require authenticated requests.
- **Rate limiting**: 120 requests/minute per IP (configurable in code).
- **Background jobs**: APScheduler runs inside the backend container. With multiple replicas, jobs would run on each instance — use `DOPAFLOW_DISABLE_BACKGROUND_JOBS=true` when running multiple instances.

---

## Docker Reference

```bash
# Build images
docker build -f Dockerfile.backend -t dopaflow-backend .
docker build -f Dockerfile.frontend -t dopaflow-frontend .

# Run without docker compose
docker run -d -p 8000:8000 \
  -v dopaflow-data:/data \
  -e DOPAFLOW_DB_PATH=/data/dopaflow.db \
  -e DOPAFLOW_ENFORCE_AUTH=true \
  -e DOPAFLOW_API_KEY=your-secret-key \
  dopaflow-backend

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart
docker compose restart backend

# Stop
docker compose down
```
