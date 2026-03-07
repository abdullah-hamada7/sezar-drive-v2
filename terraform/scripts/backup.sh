#!/bin/bash
# ==============================================================================
# Sezar Drive - PostgreSQL Backup Script
# ==============================================================================
# Uploads encrypted pg_dump backups to S3 under a date-based prefix,
# enforcing the 7/4/3 retention policy via S3 Lifecycle rules on:
#   s3://$BACKUP_BUCKET/daily/
#   s3://$BACKUP_BUCKET/weekly/    (Sundays)
#   s3://$BACKUP_BUCKET/monthly/   (1st of month)
#
# Local temp files are deleted immediately after a successful S3 upload.
# Local files NEVER accumulate on EC2.
# ==============================================================================
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
BACKUP_BUCKET="${BACKUP_BUCKET:?BACKUP_BUCKET environment variable must be set}"
POSTGRES_DB="${POSTGRES_DB:-sezar_drive}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
CONTAINER_NAME="fleet-postgres-prod"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DOW=$(date +"%u")   # 1=Mon … 7=Sun
DOM=$(date +"%d")   # Day of month (01-31)
FILENAME="db_backup_${TIMESTAMP}.sql.gz"
TMP_FILE="/tmp/${FILENAME}"

# ── Helper ─────────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

cleanup() {
  if [ -f "$TMP_FILE" ]; then
    rm -f "$TMP_FILE"
    log "Cleaned up temporary local file."
  fi
}
trap cleanup EXIT   # Always delete /tmp file (even on error)

# ── pg_dump ────────────────────────────────────────────────────────────────────
log "Starting backup for ${POSTGRES_DB}..."
docker exec "${CONTAINER_NAME}" pg_dump \
  -U "${POSTGRES_USER}" \
  "${POSTGRES_DB}" \
  | gzip > "${TMP_FILE}"

log "pg_dump complete: ${TMP_FILE}"

# ── Determine S3 prefix ───────────────────────────────────────────────────────
# Every backup is a daily. Sundays are also weeklies. 1st of month is also monthly.
PREFIXES=("daily")

if [ "$DOW" -eq 7 ]; then
  PREFIXES+=("weekly")
fi

if [ "$DOM" -eq "01" ]; then
  PREFIXES+=("monthly")
fi

# ── Upload to S3 ──────────────────────────────────────────────────────────────
UPLOAD_FAILED=0
for PREFIX in "${PREFIXES[@]}"; do
  S3_TARGET="s3://${BACKUP_BUCKET}/${PREFIX}/${FILENAME}"
  log "Uploading to ${S3_TARGET} ..."
  if aws s3 cp "${TMP_FILE}" "${S3_TARGET}" \
       --sse AES256 \
       --storage-class STANDARD_IA \
       --no-progress; then
    log "Upload succeeded: ${S3_TARGET}"
  else
    log "ERROR: Upload FAILED for ${S3_TARGET}"
    UPLOAD_FAILED=1
  fi
done

if [ "$UPLOAD_FAILED" -eq 1 ]; then
  log "ERROR: One or more S3 uploads failed. Local temp file will be removed by trap."
  exit 1
fi

log "Backup complete. Local temp file will be removed by trap."
