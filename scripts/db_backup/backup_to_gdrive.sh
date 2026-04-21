#!/bin/bash

# Configuration
BACKUP_DIR="${HOME}/supabase_backups"
DATE=$(date +%Y%m%d_%H%M)
FILE_NAME="backup_$DATE.dump"
FILE_PATH="$BACKUP_DIR/$FILE_NAME"

# Database Credentials
DB_HOST="aws-1-ap-southeast-1.pooler.supabase.com"
DB_PORT="6543"
DB_USER="postgres.yiweijonmfbritbjfadh"
DB_NAME="postgres"

# IMPORTANT: Setup your database password here. 
# Either export it directly or read from a `.env` file for better security.
export PGPASSWORD="YOUR_DATABASE_PASSWORD"

# rclone remote name for Google Drive (Assuming 'gdrive' is your configured remote name)
RCLONE_REMOTE="gdrive:supabase_backups"

echo "=== Started Supabase Backup process at $(date) ==="

# 1. Create directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# 2. Run pg_dump (Custom format)
echo "Running pg_dump to create custom dump..."
pg_dump -Fc \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -p "$DB_PORT" \
  -f "$FILE_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Backup successful: $FILE_PATH"
else
    echo "❌ Backup failed!"
    exit 1
fi

# 3. Upload to Google Drive via rclone
echo "Uploading to Google Drive ($RCLONE_REMOTE)..."
rclone copy "$FILE_PATH" "$RCLONE_REMOTE"

if [ $? -eq 0 ]; then
    echo "✅ Upload to Google Drive successful."
else
    echo "❌ Upload failed. Please check rclone configuration."
    exit 1
fi

# 4. Cleanup old backups locally (Keep only last 7 days to save space)
# Uncomment the line below after verifying everything works fine
# find "$BACKUP_DIR" -type f -name "*.dump" -mtime +7 -delete

echo "=== Backup process finished successfully at $(date) ==="
