# DopaFlow Production Deployment Guide

## Quick Start

### 1. Run the Setup Script

```bash
cd /path/to/dopaflow
chmod +x scripts/setup-production.sh
./scripts/setup-production.sh
```

This will:
- Generate secure secrets
- Set up Turso database (if CLI is installed)
- Create `.env.production` file
- Install dependencies
- Run database migrations

### 2. Configure Monitoring (Required)

#### Sentry Setup
1. Create a project at https://sentry.io
2. Copy the DSN
3. Add to `.env.production`:
   ```
   SENTRY_DSN=https://your-dsn-here
   ```

#### Slack Alerts
1. Create a webhook at https://api.slack.com/messaging/webhooks
2. Add to `.env.production`:
   ```
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

#### Backup S3 Bucket
1. Create an S3 bucket
2. Create IAM user with S3 access
3. Add to `.env.production`:
   ```
   BACKUP_S3_BUCKET=your-bucket-name
   BACKUP_AWS_ACCESS_KEY_ID=your-key
   BACKUP_AWS_SECRET_ACCESS_KEY=your-secret
   ```

### 3. Deploy with Docker Compose

```bash
# Copy environment file
cp .env.production /opt/dopaflow/.env

# Deploy
docker-compose -f docker-compose.production.yml up -d

# Run migrations
docker-compose -f docker-compose.production.yml exec backend alembic upgrade head
```

### 4. Verify Deployment

```bash
chmod +x scripts/verify-production.sh
BASE_URL=https://your-domain.com ./scripts/verify-production.sh
```

## Manual Setup (Without Script)

### Step 1: Generate Secrets

```bash
# Generate 32-character secrets
export DOPAFLOW_AUTH_TOKEN_SECRET=$(openssl rand -hex 32)
export DOPAFLOW_OPS_SECRET=$(openssl rand -hex 32)
export DOPAFLOW_API_KEY=$(openssl rand -hex 32)
```

### Step 2: Set Up Turso Database

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login

# Create database
turso db create dopaflow-prod

# Get connection details
export DOPAFLOW_TURSO_URL=$(turso db show dopaflow-prod --url)
export DOPAFLOW_TURSO_TOKEN=$(turso db tokens create dopaflow-prod)
```

### Step 3: Create Environment File

Create `.env.production`:

```bash
# Production mode
DOPAFLOW_PRODUCTION=true
DOPAFLOW_ENFORCE_AUTH=true
DOPAFLOW_DEV_AUTH=false

# Secrets (from Step 1)
DOPAFLOW_AUTH_TOKEN_SECRET=$DOPAFLOW_AUTH_TOKEN_SECRET
DOPAFLOW_OPS_SECRET=$DOPAFLOW_OPS_SECRET
DOPAFLOW_API_KEY=$DOPAFLOW_API_KEY

# Database (from Step 2)
DOPAFLOW_TURSO_URL=$DOPAFLOW_TURSO_URL
DOPAFLOW_TURSO_TOKEN=$DOPAFLOW_TURSO_TOKEN

# Application
DOPAFLOW_BASE_URL=https://dopaflow.app
DOPAFLOW_EXTRA_CORS_ORIGINS=https://dopaflow.app

# Monitoring
DOPAFLOW_APM_ENABLED=true
ENVIRONMENT=production
SERVICE_NAME=dopaflow
SENTRY_DSN=your-sentry-dsn
SLACK_WEBHOOK_URL=your-slack-webhook

# Rate limiting
RATE_LIMIT_DEFAULT=60
RATE_LIMIT_AUTHENTICATED=120
RATE_LIMIT_COMMANDS=30

# Connection pool
DOPAFLOW_DB_POOL_MIN=2
DOPAFLOW_DB_POOL_MAX=10

# Backups
BACKUP_S3_BUCKET=your-backup-bucket
BACKUP_AWS_ACCESS_KEY_ID=your-aws-key
BACKUP_AWS_SECRET_ACCESS_KEY=your-aws-secret
```

### Step 4: Run Migrations

```bash
cd backend
source venv/bin/activate
export $(cat ../.env.production | xargs)
alembic upgrade head
```

### Step 5: Deploy

```bash
# Using Docker Compose
docker-compose -f docker-compose.production.yml up -d

# Or run directly
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Post-Deployment Checklist

- [ ] Health endpoints responding (`/api/v2/health/ready`)
- [ ] HTTPS enabled with valid certificate
- [ ] CORS configured for your domain
- [ ] Sentry receiving errors
- [ ] Slack alerts working (test with `curl`)
- [ ] Backups running (check S3 bucket)
- [ ] Database migrations applied
- [ ] Feature flags accessible
- [ ] APM metrics available
- [ ] Rate limiting active

## Troubleshooting

### Database Connection Issues

```bash
# Test Turso connection
curl -H "Authorization: Bearer $DOPAFLOW_TURSO_TOKEN" \
  $DOPAFLOW_TURSO_URL/v2/pipeline
```

### Health Check Failures

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs backend

# Test locally
export $(cat .env.production | xargs)
cd backend
python -c "from app.main import create_app; app = create_app()"
```

### Migration Failures

```bash
# Check current version
cd backend
alembic current

# View history
alembic history

# Rollback if needed
alembic downgrade -1
```

## Security Hardening

### Firewall Rules

```bash
# Allow only necessary ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH
sudo ufw enable
```

### SSL/TLS Configuration

Use Traefik (included in docker-compose.production.yml) for automatic Let's Encrypt certificates, or configure your own:

```yaml
# traefik.yml
certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com
      storage: /letsencrypt/acme.json
      tlsChallenge: {}
```

### Database Security

- Use Turso's built-in encryption
- Rotate tokens regularly: `turso db tokens create dopaflow-prod --expiration 30d`
- Enable audit logging in Turso dashboard

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.production.yml
services:
  backend:
    deploy:
      replicas: 3
```

### Database Read Replicas

```bash
# Create replica
turso db replicate dopaflow-prod region-name

# Update environment
DOPAFLOW_TURSO_REPLICA_URL=libsql://replica-url
```

## Monitoring Setup

### Grafana Dashboards

Access at `http://your-server:3000`

Default credentials:
- Username: `admin`
- Password: Set via `GRAFANA_ADMIN_PASSWORD`

### Prometheus Metrics

Access at `http://your-server:9090`

### Health Alert Manager

Configured automatically in production mode. Check status:

```bash
curl https://your-domain.com/api/v2/health
curl https://your-domain.com/api/v2/apm/metrics
```

## Backup Verification

Test your backups:

```bash
# List backups
docker-compose -f docker-compose.production.yml exec backup ls -la /archive

# Test restore (on staging)
# Copy backup to staging and restore
```

## Support

- Documentation: `docs/CICD_OPERATIONS.md`
- Issues: GitHub Issues
- Logs: `docker-compose logs -f backend`
