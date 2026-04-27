#!/bin/bash
# Production Deployment Verification Script
# Run this after deployment to verify everything is working

set -euo pipefail

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8000}"
TIMEOUT=10

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[PASS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[FAIL]${NC} $1"; }

TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local name="$1"
    local command="$2"
    
    if eval "$command" >/dev/null 2>&1; then
        log "$name"
        ((TESTS_PASSED++))
        return 0
    else
        error "$name"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "DopaFlow Production Verification"
echo "================================="
echo "Testing: $BASE_URL"
echo ""

# Health Checks
run_test "Health endpoint responds" "curl -sf --max-time $TIMEOUT $BASE_URL/api/v2/health"
run_test "Health live endpoint" "curl -sf --max-time $TIMEOUT $BASE_URL/api/v2/health/live"
run_test "Health ready endpoint" "curl -sf --max-time $TIMEOUT $BASE_URL/api/v2/health/ready"
run_test "Metrics endpoint" "curl -sf --max-time $TIMEOUT $BASE_URL/api/v2/health/metrics"

# Security Checks
echo ""
echo "Security Checks:"

# Check if production mode is enabled
PRODUCTION_MODE=$(curl -sf --max-time $TIMEOUT $BASE_URL/api/v2/health 2>/dev/null | grep -o '"production":true' || true)
if [ -n "$PRODUCTION_MODE" ]; then
    log "Production mode enabled"
else
    warn "Production mode not detected"
fi

# Check if dev auth is disabled
DEV_AUTH=$(curl -sf --max-time $TIMEOUT $BASE_URL/api/v2/health 2>/dev/null | grep -o '"dev_auth":true' || true)
if [ -z "$DEV_AUTH" ]; then
    log "Dev auth is disabled"
else
    error "Dev auth is enabled (security risk!)"
fi

# Check HTTPS (if not localhost)
if [[ "$BASE_URL" != *"localhost"* ]] && [[ "$BASE_URL" != *"127.0.0.1"* ]]; then
    if [[ "$BASE_URL" == https://* ]]; then
        log "HTTPS is enabled"
    else
        error "HTTPS not detected (required for production)"
    fi
fi

# API Checks
echo ""
echo "API Checks:"

run_test "API documentation (if enabled)" "curl -sf --max-time $TIMEOUT $BASE_URL/api/v2/docs" || warn "API docs may be disabled in production"
run_test "OpenAPI schema (if enabled)" "curl -sf --max-time $TIMEOUT $BASE_URL/api/v2/openapi.json" || warn "OpenAPI may be disabled in production"

# Feature Checks
echo ""
echo "Feature Checks:"

# Check feature flags endpoint
run_test "Feature flags endpoint" "curl -sf --max-time $TIMEOUT $BASE_URL/api/v2/feature-flags" || warn "Feature flags may be disabled"

# Check APM endpoint
run_test "APM metrics endpoint" "curl -sf --max-time $TIMEOUT $BASE_URL/api/v2/apm/metrics" || warn "APM may be disabled"

# Database Check
echo ""
echo "Database Check:"

DB_STATUS=$(curl -sf --max-time $TIMEOUT $BASE_URL/api/v2/health 2>/dev/null | grep -o '"database":"ok"' || true)
if [ -n "$DB_STATUS" ]; then
    log "Database connection OK"
else
    error "Database connection issue detected"
fi

# Summary
echo ""
echo "=================================="
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All critical checks passed!${NC}"
    echo "Your DopaFlow instance is ready for production."
    exit 0
else
    echo -e "${RED}Some checks failed.${NC}"
    echo "Please review the errors above."
    exit 1
fi
