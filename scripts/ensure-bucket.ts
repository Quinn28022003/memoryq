import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env first, then .env.local (local overrides). This ensures required vars from .env aren't shadowed by an empty .env.local.
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });

// Validate required env vars early
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

import { createClient } from '../src/lib/supabase/cli';
import { SUPABASE_BUCKET, SUPABASE_PRIVATE_BUCKET } from '../src/constants/storage';

async function main() {
  const supabase = createClient();
  const bucketName = SUPABASE_BUCKET;
  const privateBucketName = SUPABASE_PRIVATE_BUCKET;

  console.log(`Checking bucket: ${bucketName} (public) and ${privateBucketName} (private)...`);

  // Ensure public bucket exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error('Error listing buckets:', listError);
    process.exit(1);
  }

  const bucketExists = buckets.some((b) => b.id === bucketName);
  const privateExists = buckets.some((b) => b.id === privateBucketName);

  if (!bucketExists) {
    console.log(`Bucket ${bucketName} not found. Creating...`);
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 10485760, // 10MB
    });

    if (createError) {
      console.error('Error creating bucket:', createError);
      process.exit(1);
    }
    console.log(`Bucket ${bucketName} created successfully.`);
  } else {
    console.log(`Bucket ${bucketName} already exists.`);
  }

  // Ensure private bucket exists (private/public=false)
  if (!privateExists) {
    console.log(`Private bucket ${privateBucketName} not found. Creating...`);
    const { error: createError } = await supabase.storage.createBucket(privateBucketName, {
      public: false,
      fileSizeLimit: 10485760, // 10MB
    });

    if (createError) {
      console.error('Error creating private bucket:', createError);
      process.exit(1);
    }
    console.log(`Private bucket ${privateBucketName} created successfully.`);
  } else {
    console.log(`Private bucket ${privateBucketName} already exists.`);
  }

  // Also ensure RLS policies as a fallback (though service role bypasses)
  console.log('Finished.');
}

main();
