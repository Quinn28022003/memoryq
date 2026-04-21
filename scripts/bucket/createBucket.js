// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('@supabase/supabase-js');

async function createBucketIfNotExists(name, isPublic) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Check if the bucket already exists
    const { data, error } = await supabase.storage.getBucket(name);

    if (error && error.message !== 'Bucket not found' && error.name !== 'StorageApiError') {
      // StorageApiError is thrown when bucket is not found sometimes depending on supabase-js version
      if (!error.message.includes('not found')) {
        throw error;
      }
    }

    if (data) {
      console.log(`Bucket ${name} already exists`);
      // Optionally update public/private status if needed, but skipped for now
      return;
    }

    // Create the bucket
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data: newBucket, error: createError } = await supabase.storage.createBucket(name, {
      public: isPublic,
    });

    if (createError) throw createError;

    console.log(`Bucket ${name} created successfully (public: ${isPublic})`);
  } catch (error) {
    console.error(`Error creating bucket ${name}:`, error.message);
    process.exit(1);
  }
}

async function main() {
  const bucketName = process.env.SUPABASE_BUCKET_NAME || 'ct';
  const privateBucketName = process.env.SUPABASE_PRIVATE_BUCKET_NAME || 'ct_private';
  await createBucketIfNotExists(bucketName, true);
  await createBucketIfNotExists(privateBucketName, false);
}

if (require.main === module) {
  main();
}

module.exports = { main, createBucketIfNotExists };
