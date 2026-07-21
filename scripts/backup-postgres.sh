#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

backup_dir="${CUPTHINGS_BACKUP_DIR:-/var/backups/cupthings}"
retention_days="${CUPTHINGS_BACKUP_RETENTION_DAYS:-7}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="${backup_dir}/cupthings-${timestamp}.dump"

case "$retention_days" in
  ''|*[!0-9]*)
    echo "CUPTHINGS_BACKUP_RETENTION_DAYS must be a non-negative integer" >&2
    exit 1
    ;;
esac

umask 077
mkdir -p "$backup_dir"

pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$backup_path" \
  "$DATABASE_URL"

find "$backup_dir" -type f -name 'cupthings-*.dump' -mtime "+${retention_days}" -delete

echo "Created ${backup_path}"
