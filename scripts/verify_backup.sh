#!/bin/bash
# DopaFlow Backup Verification Script
# Run this after backups to verify integrity

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
DATA_DIR="${DATA_DIR:-/app/data}"
LOG_FILE="${LOG_FILE:-/var/log/dopaflow/backup-verify.log}"

log() {
    echo "[$(date -Iseconds)] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "[$(date -Iseconds)] ERROR: $1" | tee -a "$LOG_FILE"
    exit 1
}

# Find the most recent backup
latest_backup=$(find "$BACKUP_DIR" -name "backup-*.tar.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)

if [ -z "$latest_backup" ]; then
    error "No backup files found in $BACKUP_DIR"
fi

log "Verifying backup: $latest_backup"

# Create temp directory for extraction
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Test archive integrity
if ! tar -tzf "$latest_backup" > /dev/null 2>&1; then
    error "Backup archive is corrupted: $latest_backup"
fi

log "Archive integrity check passed"

# Extract and verify contents
tar -xzf "$latest_backup" -C "$TEMP_DIR"

# Check for required files/directories
required_paths=("data" "data/db.sqlite" "logs")
for path in "${required_paths[@]}"; do
    if [ ! -e "$TEMP_DIR/$path" ]; then
        error "Missing required path in backup: $path"
    fi
done

log "Backup contents verified"

# Check backup size
backup_size=$(stat -f%z "$latest_backup" 2>/dev/null || stat -c%s "$latest_backup")
data_size=$(du -sb "$DATA_DIR" | cut -f1)

# Backup should be at least 10% of data size (compressed)
min_expected_size=$((data_size / 10))

if [ "$backup_size" -lt "$min_expected_size" ]; then
    error "Backup size ($backup_size) is suspiciously small (expected at least $min_expected_size)"
fi

log "Backup size check passed ($backup_size bytes)"

# Test database integrity if sqlite3 is available
if command -v sqlite3 &> /dev/null; then
    db_file="$TEMP_DIR/data/db.sqlite"
    if [ -f "$db_file" ]; then
        if ! sqlite3 "$db_file" "PRAGMA integrity_check;" | grep -q "ok"; then
            error "Database integrity check failed"
        fi
        log "Database integrity check passed"
    fi
fi

log "Backup verification completed successfully"
exit 0
