#!/bin/bash

# Configuration
BACKUP_DIR="${HOME}/supabase_backups"

# Database Credentials
DB_HOST="aws-1-ap-southeast-1.pooler.supabase.com"
DB_PORT="6543"
DB_USER="postgres.yiweijonmfbritbjfadh"
DB_NAME="postgres"

# IMPORTANT: Setup your database password here.
export PGPASSWORD="YOUR_DATABASE_PASSWORD"

# rclone remote name for Google Drive
RCLONE_REMOTE="gdrive:supabase_backups"

# Validate Arguments
if [ -z "$1" ]; then
  echo "Usage: ./restore_from_gdrive.sh <backup_filename.dump>"
  echo "Example: ./restore_from_gdrive.sh backup_20260221_0200.dump"
  exit 1
fi

FILE_NAME="$1"
FILE_PATH="$BACKUP_DIR/$FILE_NAME"

echo "=== Supabase Restore Process ==="

# 1. Check if file exists locally, if not try to download from GDrive
if [ ! -f "$FILE_PATH" ]; then
    echo "File '$FILE_NAME' not found locally."
    echo "Attempting to download from Google Drive..."
    mkdir -p "$BACKUP_DIR"
    
    # Use rclone to copy specifically this file
    rclone copy "$RCLONE_REMOTE/$FILE_NAME" "$BACKUP_DIR"
    
    if [ ! -f "$FILE_PATH" ]; then
        echo "❌ Error: Could not find or download the backup file from Google Drive."
        exit 1
    fi
    echo "✅ Downloaded successfully."
fi

# 2. Warning prompt
echo ""
echo "!!! WARNING: DESTRUCTIVE ACTION !!!"
echo "You are about to RESTORE the database and OVERWRITE existing data."
echo "Target DB Host: $DB_HOST"
echo "File to restore: $FILE_NAME"
echo ""
read -p "Are you ABSOLUTELY sure you want to proceed? (y/N): " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Restore cancelled."
    exit 0
fi

echo "Starting restore process... Please wait."

# 3. Run pg_restore
# --clean --if-exists: drops existing schema before recreating
# --no-owner: skips commands to set ownership, often safer for Supabase hosted Postgres
pg_restore \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -p "$DB_PORT" \
  --clean --if-exists \
  --no-owner \
  "$FILE_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Restore process finished successfully."
else
    echo "⚠️ Restore finished with some errors/warnings. Check the output above."
fi
