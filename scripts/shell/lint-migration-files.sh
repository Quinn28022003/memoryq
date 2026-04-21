#!/usr/bin/env bash

set -euo pipefail

# Ensure globbing returns empty array when no matches
shopt -s nullglob

files=(supabase/migrations/*.sql)

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No migration files found under supabase/migrations. Skipping lint."
  exit 0
fi

echo "Checking migration file naming convention..."

has_error=0
for file in "${files[@]}"; do
  filename=$(basename "$file")
  if [[ ! "$filename" =~ ^[0-9]{14}_.+\.sql$ ]]; then
    echo "❌ Migration file $filename does not follow naming convention: YYYYMMDDHHMMSS_description.sql"
    has_error=1
  fi
done

if [[ $has_error -eq 1 ]]; then
  exit 1
fi

echo "✅ All migration files follow proper naming convention"


