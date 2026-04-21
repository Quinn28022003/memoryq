#!/usr/bin/env tsx
/**
 * Supabase Storage Bucket Policy Generator CLI
 *
 * Generates SQL policies for a bucket (defaults to the private bucket env var).
 *
 * Usage:
 *   npx tsx scripts/bucket/generate-policy.ts [--bucket <name>] [--output <path>]
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from project .env (allow overrides in .env.local)
const envLocal = path.resolve(process.cwd(), '.env.local');
const envFile = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envFile)) dotenv.config({ path: envFile });
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });

// Priority: CLI arg > private-bucket env var > public bucket env var > default
const cliHas = (flag: string) => process.argv.includes(flag);
const cliGet = (flag: string) =>
  cliHas(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined;

const BUCKET_NAME =
  cliGet('--bucket') ||
  process.env.SUPABASE_PRIVATE_BUCKET_NAME ||
  process.env.NEXT_PUBLIC_SUPABASE_BUCKET_NAME ||
  'storage';

const OUTPUT_FILE =
  cliGet('--output') || path.join(__dirname, `${BUCKET_NAME}-bucket-policies.sql`);

if (cliHas('--help')) {
  console.log(`
Supabase Storage Bucket Policy Generator

Usage:
  npx tsx scripts/bucket/generate-policy.ts [options]

Options:
  --bucket <name>     Bucket name (default: SUPABASE_PRIVATE_BUCKET_NAME or NEXT_PUBLIC_SUPABASE_BUCKET_NAME)
  --output <path>     Output file path (default: './<bucket>-bucket-policies.sql')
  --help              Show help
`);
  process.exit(0);
}

function generatePathAccessCheck(bucketName: string): string {
  // Simplified: only ensure the object belongs to the requested bucket.
  return `
  -- Ensure the object belongs to the target bucket
  bucket_id = '${bucketName}'::text
  `;
}

function generateUsingExpression(bucketName: string): string {
  // Allow super-admin OR any authenticated user for this bucket (no extra permission checks).
  return `(
  public.is_super_admin()
  OR
  (
    auth.uid() IS NOT NULL
    AND
    ${generatePathAccessCheck(bucketName)}
  )
)`;
}

function generateSQLFile(bucketName: string): string {
  const selectExpression = generateUsingExpression(bucketName);
  const insertExpression = generateUsingExpression(bucketName);
  const updateExpression = generateUsingExpression(bucketName);
  const deleteExpression = generateUsingExpression(bucketName);
  const timestamp = new Date().toISOString();

  return (
    `-- Generated storage policies for bucket: ${bucketName}\n-- Generated: ${timestamp}\n\n` +
    `DROP POLICY IF EXISTS "Allow authenticated users to SELECT files from ${bucketName}" ON storage.objects;\n` +
    `DROP POLICY IF EXISTS "Allow authenticated users to INSERT files into ${bucketName}" ON storage.objects;\n` +
    `DROP POLICY IF EXISTS "Allow authenticated users to UPDATE files in ${bucketName}" ON storage.objects;\n` +
    `DROP POLICY IF EXISTS "Allow authenticated users to DELETE files from ${bucketName}" ON storage.objects;\n\n` +
    `CREATE POLICY "Allow authenticated users to SELECT files from ${bucketName}"\nON storage.objects\nFOR SELECT\nTO authenticated\nUSING ${selectExpression};\n\n` +
    `CREATE POLICY "Allow authenticated users to INSERT files into ${bucketName}"\nON storage.objects\nFOR INSERT\nTO authenticated\nWITH CHECK ${insertExpression};\n\n` +
    `CREATE POLICY "Allow authenticated users to UPDATE files in ${bucketName}"\nON storage.objects\nFOR UPDATE\nTO authenticated\nUSING ${updateExpression}\nWITH CHECK ${updateExpression};\n\n` +
    `CREATE POLICY "Allow authenticated users to DELETE files from ${bucketName}"\nON storage.objects\nFOR DELETE\nTO authenticated\nUSING ${deleteExpression};\n`
  );
}

const sqlContent = generateSQLFile(BUCKET_NAME);
fs.writeFileSync(OUTPUT_FILE, sqlContent, 'utf8');
console.log(`✅ Generated SQL file: ${OUTPUT_FILE}`);
console.log(`   Bucket: ${BUCKET_NAME}`);
console.log('   Next: review and apply the SQL in Supabase SQL editor or add to migrations.');
