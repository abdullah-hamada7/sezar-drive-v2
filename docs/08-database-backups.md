# Database Backups (Postgres -> S3)

This repo runs PostgreSQL in Docker Compose on a single EC2 instance and performs a **daily logical backup** using `pg_dump`, uploaded to a dedicated S3 bucket with lifecycle retention.

## What is backed up (and what is not)

- **Backed up**: a `pg_dump` of the database (schema + data) compressed as `*.sql.gz`.
- **Not backed up**:
  - No physical/base backups.
  - No WAL archiving / PITR (point-in-time recovery).
  - No cross-region replication.

If the EC2 instance is **terminated/replaced** and the Docker volume is lost, recovery depends on restoring one of the S3 `pg_dump` files.

## Where Postgres runs (production)

- Compose file: `compose.prod.yml`
- Postgres image: `postgres:16-alpine`
- Container name (important): `fleet-postgres-prod`
- Data persistence: named volume `postgres_data_prod` -> `/var/lib/postgresql/data`
- Postgres config: `infra/postgres/postgresql.conf`
- Network: internal `app-net` (no host port exposed for Postgres in prod)

## Backup infrastructure (S3)

Terraform provisions a dedicated S3 bucket for DB backups:

- Terraform file: `terraform/backups.tf`
- Bucket name pattern: `${project_name}-db-backups-${random_id.bucket_id.hex}`
- Public access: blocked
- Encryption at rest: SSE-S3 (`AES256`)
- Transport: HTTPS-only bucket policy (denies insecure transport)

### Retention policy (S3 lifecycle)

Retention is enforced by S3 lifecycle rules by prefix:

- `daily/` expires after **7 days**
- `weekly/` expires after **28 days**
- `monthly/` expires after **90 days**

Notes:

- There is no "forever" retention configured in Terraform.
- Versioning on the backup bucket is **suspended**.

## Permissions (EC2 IAM role)

The EC2 instance role has a dedicated policy for the backup bucket:

- Terraform file: `terraform/iam.tf`
- Policy: `aws_iam_role_policy.db_backup_s3_access`
- Allowed actions on the DB backup bucket:
  - `s3:PutObject`
  - `s3:ListBucket`

Important limitation:

- The EC2 role does **not** have `s3:GetObject` for the DB backup bucket.
- Practical implication: restores typically require downloading the backup using workstation credentials, then copying it to the server.

## Schedule (cron)

Backups are scheduled by EC2 `user_data`:

- Script: `terraform/scripts/install_docker.sh`
- Cron schedule: **03:00 UTC daily**
- Cron command (example):

```bash
0 3 * * * BACKUP_BUCKET=<bucket> /home/ubuntu/scripts/backup.sh >> /var/log/db-backup.log 2>&1
```

## Backup execution details

Backup script:

- File: `terraform/scripts/backup.sh`
- Requirements:
  - `aws` CLI available on the host
  - `docker` available on the host
  - Postgres container `fleet-postgres-prod` running

### Inputs

Environment variables:

- `BACKUP_BUCKET` (required): target S3 bucket name
- `POSTGRES_DB` (optional; default `sezar_drive`)
- `POSTGRES_USER` (optional; default `postgres`)

### Output

- Local temp file: `/tmp/db_backup_<YYYYMMDD_HHMMSS>.sql.gz`
- S3 object key(s):
  - Always: `daily/db_backup_<timestamp>.sql.gz`
  - Additionally on Sundays: `weekly/db_backup_<timestamp>.sql.gz`
  - Additionally on day 1 of month: `monthly/db_backup_<timestamp>.sql.gz`

The same dump can be uploaded to multiple prefixes (daily + weekly and/or monthly) based on the date.

### Upload settings

The script uploads using:

- `aws s3 cp`
- Server-side encryption: `--sse AES256`
- Storage class: `--storage-class STANDARD_IA`

### Cleanup behavior

- Local temp file is deleted via a `trap` on exit (success or failure).
- Local dumps do not accumulate on disk.

## Logging

Cron appends stdout/stderr to:

- `/var/log/db-backup.log`

User-data attempts to set up log rotation:

- File: `terraform/scripts/install_docker.sh`
- Logrotate config: `/etc/logrotate.d/db-backup`

### Important: log file permissions

If `/var/log/db-backup.log` does not exist, the `ubuntu` user cannot create it (since `/var/log` is root-owned). In that case the cron command will fail at the redirection step and the backup script will not run.

Fix on the instance:

```bash
sudo touch /var/log/db-backup.log
sudo chown ubuntu:ubuntu /var/log/db-backup.log
sudo chmod 0644 /var/log/db-backup.log
```

To see cron-related errors:

```bash
sudo grep -i cron /var/log/syslog | tail -n 200
```

## Operational verification

### 1) Verify cron is present

```bash
crontab -l | grep backup.sh
```

### 2) Verify the script path exists and is executable

```bash
ls -l /home/ubuntu/scripts/backup.sh
```

### 3) Run a manual backup (dry-run via real execution)

```bash
BACKUP_BUCKET=<bucket> /home/ubuntu/scripts/backup.sh
```

### 4) Confirm objects in S3

From a machine with S3 read permissions:

```bash
aws s3 ls "s3://<bucket>/daily/" --human-readable
aws s3 ls "s3://<bucket>/weekly/" --human-readable
aws s3 ls "s3://<bucket>/monthly/" --human-readable
```

## Restore procedure (logical restore from S3 dump)

This is destructive if you drop/recreate the target database. Plan a maintenance window.

### 1) Get a backup file

Because EC2 lacks `s3:GetObject` on the backup bucket, download on your workstation:

```bash
aws s3 cp "s3://<bucket>/daily/<db_backup_YYYYMMDD_HHMMSS.sql.gz>" .
```

Copy to server:

```bash
scp -i "<key>.pem" "./<backup>.sql.gz" ubuntu@<PUBLIC_IP>:/home/ubuntu/
```

### 2) Stop app writes during restore

```bash
docker compose -f compose.prod.yml stop backend
```

### 3) (Recommended) Recreate the database

```bash
set -a
source ./.env
set +a

docker exec -i fleet-postgres-prod psql -U "$POSTGRES_USER" -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${POSTGRES_DB}' AND pid <> pg_backend_pid();"

docker exec -i fleet-postgres-prod psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};"
docker exec -i fleet-postgres-prod psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE ${POSTGRES_DB};"
```

### 4) Restore the dump

```bash
gunzip -c "/home/ubuntu/<backup>.sql.gz" \
  | docker exec -i fleet-postgres-prod psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

### 5) Bring the backend back and apply migrations (if needed)

```bash
docker compose -f compose.prod.yml up -d backend
docker compose -f compose.prod.yml exec backend npx prisma migrate deploy
```

## Common failure modes

- **Cron runs but no backups appear**: `/var/log/db-backup.log` missing/unwritable (redirection fails before script runs).
- **Script path missing**: `/home/ubuntu/scripts/backup.sh` not created on new instances unless you copy/symlink it after deploy.
- **Wrong container name**: script hardcodes `fleet-postgres-prod`.
- **AWS CLI missing**: `aws` not installed (user-data did not complete).
- **IAM denies S3 upload**: EC2 role missing `s3:PutObject` for the backup bucket.
- **DB auth fails**: `POSTGRES_USER`/`POSTGRES_DB` mismatch with what exists inside Postgres.
- **Disk pressure**: `/tmp` too small for dump + compression.

## Related docs

- Recovery runbook: `recovery.md`
- Infrastructure provisioning: `terraform/`
