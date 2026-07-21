# PostgreSQL Backup

CupThings uses an external `pg_dump` backup job. The application does not store backup credentials or upload backup files.

## Manual backup

Set `DATABASE_URL` in the shell or a protected service environment, then run:

```sh
CUPTHINGS_BACKUP_DIR=/var/backups/cupthings ./scripts/backup-postgres.sh
```

The script creates a compressed custom-format dump with permissions restricted by `umask 077`. By default it retains dump files from the last 7 days. Set `CUPTHINGS_BACKUP_RETENTION_DAYS` to change retention.

## Daily cron

Run the job from the repository checkout with a protected environment file:

```cron
15 2 * * * cd /Users/nic/prj/CupThings && . /etc/cupthings/backup.env && CUPTHINGS_BACKUP_DIR=/var/backups/cupthings ./scripts/backup-postgres.sh >> /var/log/cupthings-backup.log 2>&1
```

The environment file must be readable only by the backup service account. Store backups on a different disk or host, encrypt them at rest, and monitor job failures.

## Restore drill

Restore into an empty, isolated database. Do not restore over production without a separate approval and current backup:

```sh
createdb cupthings_restore_check
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname="$RESTORE_DATABASE_URL" \
  /var/backups/cupthings/cupthings-YYYYMMDDTHHMMSSZ.dump
```

After restoring, run the API readiness check and verify that `profiles` and `cup_things` contain the expected rows. Perform a restore drill at least monthly.
