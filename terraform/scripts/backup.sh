#!/bin/bash
# Sezar Drive Database Backup Script
# Retention: 7 days

BACKUP_DIR="/home/ubuntu/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATABASE_NAME="${DATABASE_NAME:-sezar_drive}"
CONTAINER_NAME="fleet-postgres-prod" # Matches compose.prod.yml

mkdir -p $BACKUP_DIR

echo "Starting backup for $DATABASE_NAME at $TIMESTAMP..."

# Perform backup using docker exec (assuming postgres is in a container)
echo "Executing pg_dump..."
docker exec $CONTAINER_NAME pg_dump -U postgres $DATABASE_NAME | gzip > "$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

if [ $? -eq 0 ]; then
    echo "Backup successful: $BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"
    
    # Upload to S3 if BUCKET_NAME is provided
    if [ ! -z "$S3_BUCKET" ]; then
        echo "Uploading to S3: s3://$S3_BUCKET/backups/db_backup_$TIMESTAMP.sql.gz"
        aws s3 cp "$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz" "s3://$S3_BUCKET/backups/db_backup_$TIMESTAMP.sql.gz"
        if [ $? -eq 0 ]; then
            echo "S3 upload successful."
        else
            echo "S3 upload failed!"
        fi
    else
        echo "S3_BUCKET not set, skipping remote upload."
    fi
else
    echo "Backup failed!"
    exit 1
fi

# Rotate backups: Keep only the 7 most recent
ls -t $BACKUP_DIR/db_backup_*.sql.gz | tail -n +8 | xargs -r rm

echo "Backup rotation complete."
