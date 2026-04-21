#!/usr/bin/env bash

set -euo pipefail

# Default connection URL can be overridden by env var DB_URL
DB_URL=${DB_URL:-postgresql://postgres:postgres@localhost:5432/postgres}
PSQL="psql ${DB_URL} -v ON_ERROR_STOP=1"

echo "Using database URL: ${DB_URL}"

# Ensure roles commonly used by Supabase migrations exist
${PSQL} <<'SQL'
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;
END
$body$;
SQL

# Enable common extensions used in migrations
${PSQL} -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
${PSQL} -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";'

# Create minimal auth schema and helpers used by migrations
${PSQL} <<'SQL'
CREATE SCHEMA IF NOT EXISTS auth;

-- Create a users table compatible with Supabase auth.users
CREATE TABLE IF NOT EXISTS auth.users (
  instance_id uuid,
  id uuid NOT NULL,
  aud character varying,
  role character varying,
  email character varying,
  encrypted_password character varying,
  invited_at timestamp with time zone,
  confirmation_token character varying,
  confirmation_sent_at timestamp with time zone,
  recovery_token character varying,
  recovery_sent_at timestamp with time zone,
  email_change character varying,
  email_change_sent_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  email_confirmed_at timestamp with time zone,
  email_change_token_new character varying,
  phone_confirmed_at timestamp with time zone,
  phone_change_sent_at timestamp with time zone,
  phone_change_token character varying,
  phone text UNIQUE,
  confirmed_at timestamp with time zone,
  email_change_token_current character varying,
  email_change_confirm_status smallint,
  banned_until timestamp with time zone,
  reauthentication_token character varying,
  reauthentication_sent_at timestamp with time zone,
  is_sso_user boolean,
  phone_change text,
  deleted_at timestamp with time zone,
  is_anonymous boolean,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Minimal auth.uid() to satisfy policy expressions
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT '00000000-0000-0000-0000-000000000000'::uuid;
$$;

-- Simulate storage.objects table
CREATE SCHEMA IF NOT EXISTS storage;

create table storage.objects (
  id uuid,
  bucket_id text null,
  name text null,
  owner uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  last_accessed_at timestamp with time zone null default now(),
  metadata jsonb null,
  path_tokens text[],
  version text null,
  owner_id text null,
  user_metadata jsonb null,
  level integer null
);
SQL

# Collect migration files
mapfile -t files < <(ls -1 supabase/migrations/*.sql 2>/dev/null | sort)

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No migration files found under supabase/migrations/*.sql"
  exit 0
fi

echo "Applying ${#files[@]} migration file(s) in order..."

for file in "${files[@]}"; do
  echo "Applying: ${file}"
  ${PSQL} -f "${file}"
done

echo "All migrations applied successfully in dry-run environment."


