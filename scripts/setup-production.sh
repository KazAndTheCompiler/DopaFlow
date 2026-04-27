#!/bin/bash
# Production Setup Script for DopaFlow
# Run this script to prepare your production environment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root"
fi

log "DopaFlow Production Setup"
log "=========================="
echo ""

# =============================================================================
# STEP 1: Check Prerequisites
# =============================================================================

log "Step 1: Checking prerequisites..."

# Check for required tools
command -v python3 >/dev/null 2>&1 || error "Python 3 is required"
command -v pip3 >/dev/null 2>&1 || error "pip3 is required"
command -v openssl >/dev/null 2>&1 || error "openssl is required"
command -v curl >/dev/null 2>&1 || error "curl is required"

# Check Python version
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
log "Python version: $PYTHON_VERSION"

# Check for Turso CLI (optional but recommended)
if command -v turso >/dev/null 2>&1; then
    log "Turso CLI found"
    TURSO_AVAILABLE=true
else
    warn "Turso CLI not found. Install from: https://docs.turso.tech/reference/turso-cli"
    TURSO_AVAILABLE=false
fi

# =============================================================================
# STEP 2: Generate Secrets
# =============================================================================

log "Step 2: Generating secrets..."

AUTH_TOKEN_SECRET=$(openssl rand -hex 32)
OPS_SECRET=$(openssl rand -hex 32)
API_KEY=$(openssl rand -hex 32)

log "Secrets generated (save these securely!):"
echo "  AUTH_TOKEN_SECRET: ${AUTH_TOKEN_SECRET:0:8}..."
echo "  OPS_SECRET: ${OPS_SECRET:0:8}..."
echo "  API_KEY: ${API_KEY:0:8}..."
echo ""

# =============================================================================
# STEP 3: Database Setup
# =============================================================================

log "Step 3: Database setup..."

if [ "$TURSO_AVAILABLE" = true ]; then
    log "Turso CLI detected. Setting up database..."
    
    # Check if already authenticated
    if ! turso auth token >/dev/null 2>&1; then
        warn "Please authenticate with Turso:"
        turso auth login
    fi
    
    # Create database if it doesn't exist
    DB_NAME="dopaflow-prod"
    if ! turso db list | grep -q "$DB_NAME"; then
        log "Creating Turso database: $DB_NAME"
        turso db create "$DB_NAME"
    else
        log "Database $DB_NAME already exists"
    fi
    
    # Get database URL
    TURSO_URL=$(turso db show "$DB_NAME" --url)
    log "Turso URL: $TURSO_URL"
    
    # Create auth token
    TURSO_TOKEN=$(turso db tokens create "$DB_NAME")
    log "Turso token created"
    
else
    warn "Turso CLI not available. You'll need to:"
    warn "  1. Create a database at https://turso.tech"
    warn "  2. Get the database URL"
    warn "  3. Create an auth token"
    
    read -p "Enter your Turso database URL (libsql://...): " TURSO_URL
    read -p "Enter your Turso auth token: " TURSO_TOKEN
fi

# =============================================================================
# STEP 4: Create Environment File
# =============================================================================

log "Step 4: Creating production environment file..."

ENV_FILE=".env.production"

if [ -f "$ENV_FILE" ]; then
    warn "$ENV_FILE already exists. Creating backup..."
    cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d%H%M%S)"
fi

cat > "$ENV_FILE" << EOF
# DopaFlow Production Environment
# Generated on $(date -Iseconds)

# Production Mode
DOPAFLOW_PRODUCTION=true
DOPAFLOW_ENFORCE_AUTH=true
DOPAFLOW_DEV_AUTH=false

# Security Secrets
DOPAFLOW_AUTH_TOKEN_SECRET=$AUTH_TOKEN_SECRET
DOPAFLOW_OPS_SECRET=$OPS_SECRET
DOPAFLOW_API_KEY=$API_KEY

# Database
DOPAFLOW_TURSO_URL=$TURSO_URL
DOPAFLOW_TURSO_TOKEN=$TURSO_TOKEN

# Application
DOPAFLOW_BASE_URL=https://dopaflow.app
DOPAFLOW_EXTRA_CORS_ORIGINS=https://dopaflow.app

# Monitoring
DOPAFLOW_APM_ENABLED=true
ENVIRONMENT=production
SERVICE_NAME=dopaflow

# Rate Limiting
RATE_LIMIT_DEFAULT=60
RATE_LIMIT_AUTHENTICATED=120
RATE_LIMIT_COMMANDS=30
RATE_LIMIT_PACKY=20
RATE_LIMIT_HEALTH=300

# Connection Pool
DOPAFLOW_DB_POOL_MIN=2
DOPAFLOW_DB_POOL_MAX=10
DOPAFLOW_DB_TIMEOUT=30.0

# Health Checks
HEALTH_CHECK_INTERVAL=60
ALERT_COOLDOWN_SECONDS=300

# Feature Flags
DOPAFLOW_FEATURE_FLAGS_ENABLED=true

# Chaos (DISABLED)
CHAOS_ENABLED=false
EOF

log "Environment file created: $ENV_FILE"

# =============================================================================
# STEP 5: Install Dependencies
# =============================================================================

log "Step 5: Installing backend dependencies..."

cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    log "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
log "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# =============================================================================
# STEP 6: Run Database Migrations
# =============================================================================

log "Step 6: Running database migrations..."

# Set environment for migrations
export DOPAFLOW_TURSO_URL="$TURSO_URL"
export DOPAFLOW_TURSO_TOKEN="$TURSO_TOKEN"

alembic upgrade head

log "Migrations completed"

# =============================================================================
# STEP 7: Verify Setup
# =============================================================================

log "Step 7: Verifying setup..."

# Test Python imports
python3 -c "from app.main import create_app; print('✓ Backend imports OK')"

# Test configuration
python3 -c "
from app.core.config import get_settings
import os
os.environ['DOPAFLOW_PRODUCTION'] = 'true'
os.environ['DOPAFLOW_ENFORCE_AUTH'] = 'true'
os.environ['DOPAFLOW_AUTH_TOKEN_SECRET'] = 'test-secret-32-chars-minimum-ok'
os.environ['DOPAFLOW_OPS_SECRET'] = 'test-ops-secret-here-ok'
try:
    settings = get_settings()
    print('✓ Configuration validation OK')
except Exception as e:
    print(f'✗ Configuration error: {e}')
    exit(1)
"

# =============================================================================
# STEP 8: Production Checklist
# =============================================================================

echo ""
log "Production Setup Complete!"
echo "=========================="
echo ""
echo "Next steps:"
echo ""
echo "1. Review the environment file:"
echo "   cat $ENV_FILE"
echo ""
echo "2. Set up monitoring:"
echo "   - Configure Sentry DSN in $ENV_FILE"
echo "   - Set up Slack webhook for alerts"
echo "   - Configure backup S3 bucket"
echo ""
echo "3. Deploy the application:"
echo "   - Copy $ENV_FILE to your server as .env"
echo "   - Use docker-compose.production.yml for deployment"
echo "   - Or run: uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo ""
echo "4. Verify deployment:"
echo "   curl https://your-domain.com/api/v2/health/ready"
echo ""
echo "5. Set up CI/CD:"
echo "   - Configure GitHub Secrets (see docs/CICD_OPERATIONS.md)"
echo "   - Push to main branch triggers staging deployment"
echo "   - Create a tag (v*) triggers production deployment"
echo ""
echo "IMPORTANT: Keep your .env file secure and never commit it!"
echo ""

# Make the env file readable only by owner
chmod 600 "$ENV_FILE"

log "Setup complete!"
