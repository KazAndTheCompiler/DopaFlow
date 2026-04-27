# DopaFlow CI/CD and Operations Guide

## Overview

This document describes the CI/CD pipeline, backup strategy, and log aggregation setup for DopaFlow.

---

## CI/CD Pipeline

### GitHub Actions Workflows

#### 1. Frontend CI (`.github/workflows/frontend-ci.yml`)
**Triggers:** Push to `main`/`dev` branches, PRs affecting frontend code

**Jobs:**
- ESLint validation
- TypeScript type checking
- Prettier format checking
- Unit tests with coverage
- Dependency audit
- Build verification
- Playwright E2E smoke tests

#### 2. Backend CI (`.github/workflows/backend-tests.yml`)
**Triggers:** Push to `main`/`dev` branches, PRs affecting backend code

**Jobs:**
- Ruff linting
- Format checking
- Dependency audit (pip-audit)
- OpenAPI schema validation
- API contract checking (breaking changes)
- Test suite with coverage

#### 3. Deploy to Staging (`.github/workflows/deploy-staging.yml`)
**Triggers:** Push to `main`, manual dispatch

**Jobs:**
- Build Docker images for backend and frontend
- Push to GitHub Container Registry (GHCR)
- Deploy to staging server via SSH
- Run database migrations
- Verify deployment health

#### 4. Deploy to Production (`.github/workflows/deploy-production.yml`)
**Triggers:** Version tags (`v*`), manual dispatch

**Jobs:**
- Build production Docker images
- Push to GHCR with version tags
- Deploy to production with zero-downtime
- Run database migrations
- Verify deployment health
- Slack notifications on failure

#### 5. Release Build (`.github/workflows/release.yml`)
**Triggers:** Version tags

**Jobs:**
- Build backend binaries (Linux, Windows)
- Build desktop applications (AppImage, NSIS installer)
- Create GitHub release with artifacts

---

## Deployment Environments

### Staging Environment

**URL:** https://staging.dopaflow.app

**Docker Compose:** `docker-compose.staging.yml`

**Services:**
- `backend`: Staging backend API
- `frontend`: Staging frontend (nginx)
- `vector`: Log aggregation
- `backup`: Automated backup service

**Deployment:**
```bash
# Automatic on push to main
# Or manual trigger:
gh workflow run deploy-staging.yml
```

### Production Environment

**URL:** https://dopaflow.app

**Docker Compose:** `docker-compose.production.yml`

**Services:**
- `backend`: Production API (2 replicas)
- `frontend`: Production frontend (2 replicas)
- `traefik`: Reverse proxy with SSL
- `vector`: Log aggregation
- `prometheus`: Metrics collection
- `grafana`: Monitoring dashboards
- `backup`: Automated backup service

**Deployment:**
```bash
# Via version tag
git tag v2.1.0
git push origin v2.1.0

# Or manual trigger:
gh workflow run deploy-production.yml -f tag=v2.1.0
```

---

## Backup Strategy

### Automated Backups

**Tool:** `offen/docker-volume-backup`

**Schedule:** Daily at 2:00 AM UTC

**Retention:**
- Staging: 7 days
- Production: 30 days

**Storage:**
- Local: `/app/backups`
- S3: Configured via environment variables

**Configuration:**
```yaml
BACKUP_CRON_EXPRESSION: "0 2 * * *"
BACKUP_RETENTION_DAYS: "30"
BACKUP_FILENAME: "backup-%Y-%m-%dT%H-%M-%S.tar.gz"
AWS_S3_BUCKET_NAME: ${BACKUP_S3_BUCKET}
AWS_S3_PATH: "dopaflow/backups"
```

### Backup Verification

**Script:** `scripts/verify_backup.sh`

**Checks:**
1. Archive integrity (tar test)
2. Required files present
3. Size validation
4. Database integrity (SQLite PRAGMA)

**Manual verification:**
```bash
docker-compose exec backup /scripts/verify_backup.sh
```

### Manual Backup

```bash
# Create manual backup
docker-compose exec backup backup

# List backups
docker-compose exec backup ls -la /archive

# Restore from backup (staging only)
docker-compose down
docker-compose up -d backup
docker-compose exec backup restore backup-2024-01-15T02-00-00.tar.gz
```

---

## Log Aggregation

### Architecture

**Collector:** Vector (timberio/vector)

**Sources:**
- Docker container logs
- File logs (`/var/log/dopaflow/*.log`)
- Journald (production)

**Sinks:**
- Console (debugging)
- File backup (local)
- S3 archive (long-term)
- HTTP webhook (error alerts)
- Prometheus metrics

### Log Processing

**Pipeline:**
1. **Collect:** Docker logs, file logs
2. **Parse:** JSON parsing, timestamp normalization
3. **Enrich:** Add service tags, environment labels
4. **Categorize:** Extract log levels, severity scores
5. **Filter:** Sample debug logs, filter errors
6. **Route:** Multiple sinks based on log type

### Configuration Files

- **Staging:** `vector/vector-staging.toml`
- **Production:** `vector/vector-production.toml`

### Viewing Logs

```bash
# Real-time logs
docker-compose logs -f backend

# Aggregated logs
tail -f /var/log/dopaflow/aggregated/$(date +%Y/%m/%d)/vector-backend-info.log

# Error logs only
docker-compose logs -f vector | jq 'select(.severity >= 4)'
```

---

## Monitoring

### Prometheus Metrics

**Endpoint:** http://localhost:9090

**Scraped Targets:**
- Backend: `/api/v2/health/metrics`
- Vector: `:9598` (log metrics)
- Traefik: `:8080` (access logs)

### Grafana Dashboards

**URL:** http://localhost:3000

**Dashboards:**
- `dopaflow-monitoring.json`: Application overview
  - Backend status
  - Log rate by service
  - Error counts
  - Log level distribution

**Default Credentials:**
- Username: `admin`
- Password: Configured via `GRAFANA_ADMIN_PASSWORD`

### Health Checks

**Endpoints:**
- `/api/v2/health/live`: Liveness probe
- `/api/v2/health/ready`: Readiness probe
- `/api/v2/health/metrics`: Prometheus metrics

**Docker Healthcheck:**
```yaml
healthcheck:
  test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v2/health/live')"]
  interval: 30s
  timeout: 10s
  retries: 3
```

---

## Required Secrets

Configure these in GitHub repository settings:

### Deployment Secrets
- `STAGING_SSH_KEY`: SSH private key for staging server
- `STAGING_HOST`: Staging server hostname
- `STAGING_USER`: SSH username for staging
- `PRODUCTION_SSH_KEY`: SSH private key for production server
- `PRODUCTION_HOST`: Production server hostname
- `PRODUCTION_USER`: SSH username for production

### Backup Secrets
- `BACKUP_S3_BUCKET`: S3 bucket name
- `BACKUP_AWS_ACCESS_KEY_ID`: AWS access key
- `BACKUP_AWS_SECRET_ACCESS_KEY`: AWS secret key
- `BACKUP_AWS_ENDPOINT`: S3 endpoint (optional)
- `BACKUP_NOTIFICATION_URL`: Webhook for backup notifications

### Monitoring Secrets
- `GRAFANA_ADMIN_PASSWORD`: Grafana admin password
- `S3_LOG_BUCKET`: S3 bucket for log archives
- `S3_ENDPOINT`: S3-compatible endpoint
- `ERROR_WEBHOOK_URL`: Webhook for error alerts
- `SLACK_WEBHOOK_URL`: Slack notifications

---

## Operations Runbook

### Rolling Back a Deployment

```bash
# Production rollback
cd /opt/dopaflow
docker-compose pull
docker-compose up -d --no-deps backend
docker-compose exec backend alembic downgrade -1  # If needed
```

### Scaling Services

```bash
# Scale backend to 3 replicas
docker-compose up -d --scale backend=3 backend

# Scale back to 2
docker-compose up -d --scale backend=2 backend
```

### Database Migrations

```bash
# Run migrations manually
docker-compose exec backend alembic upgrade head

# Check migration status
docker-compose exec backend alembic current

# Rollback one migration
docker-compose exec backend alembic downgrade -1
```

### Log Rotation

Docker automatically rotates logs based on compose configuration:
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "10"
```

### Troubleshooting

**Check service status:**
```bash
docker-compose ps
docker-compose logs --tail=100 backend
```

**Restart services:**
```bash
docker-compose restart backend
docker-compose restart vector
```

**View metrics:**
```bash
curl http://localhost:9090/api/v1/targets
curl http://localhost:8000/api/v2/health/metrics
```

---

## Security Considerations

1. **Secrets Management**: All secrets stored in GitHub Secrets, never in code
2. **SSH Keys**: Use dedicated deployment keys, not personal keys
3. **Backup Encryption**: S3 backups use server-side encryption
4. **Log Sanitization**: Vector configuration filters sensitive data
5. **Network Isolation**: Services communicate via internal Docker network
6. **SSL/TLS**: Traefik handles SSL termination with Let's Encrypt

---

## Maintenance Windows

**Recommended:**
- Deployments: Tuesday-Thursday, 10:00-16:00 UTC
- Backups: Daily 02:00 UTC (low traffic)
- Log cleanup: Weekly
- Security updates: Monthly

---

*Last updated: April 27, 2026*
