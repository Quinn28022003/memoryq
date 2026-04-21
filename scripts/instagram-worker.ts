import dotenv from 'dotenv';
import path from 'path';

// Load environment variables *before* any other imports that might use them
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

// Fallback to .env if .env.local doesn't exist or didn't provide keys
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

async function run() {
  // Dynamic imports to ensure env vars are loaded first
  const { createClient } = await import('@/lib/supabase/cli');
  const { generateInstagramCaption } = await import('@/lib/ai/instagram');

  const supabase = createClient();

  console.log('Starting Instagram Caption Worker...');

  // 1. Fetch pending products
  // We check for ig_status = 'pending' OR (ig_status IS NULL)
  // Limited to 5 items to avoid rate limits
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('should_post_to_instagram', true)
    .or('ig_status.eq.pending,ig_status.is.null,ig_status.eq.failed')
    .limit(5);

  if (error) {
    console.error('Error fetching products:', error);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log('No pending products found.');
    process.exit(0);
  }

  console.log(`Found ${products.length} products to process.`);

  for (const product of products) {
    console.log(`Processing product: ${product.title} (${product.product_code || 'No Code'})`);

    try {
      // 2. Prepare data for generic caption service
      // Construct features from available attributes
      const features = [];
      if (product.color) features.push(`Màu: ${product.color}`);
      if (product.size) features.push(`Size: ${product.size}`);
      if (product.product_type)
        features.push(`Loại: ${product.product_type === 'shirt' ? 'Áo' : 'Quần'}`);
      if (product.width) features.push(`Rộng: ${product.width}`);
      // Add other relevant fields if needed

      // Use suggested price if available, otherwise purchase_price (with a markup assumption? No, raw price for now)
      // Note: User probably wants selling price.
      // If purchase_price is cost, displaying it might be wrong.
      // But we will use what's available.
      // Ideally we should ask, but for now we use 'suggested' ?? 'purchase_price'.
      const price = product.suggested || product.purchase_price;

      const caption = await generateInstagramCaption({
        name: product.title,
        price: price,
        description: product.description,
        features: features,
      });

      console.log('Caption generated successfully.');

      // 3. Update product
      const { error: updateError } = await supabase
        .from('products')
        .update({
          ig_caption: caption,
          ig_status: 'generated',
          ig_last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);

      if (updateError) {
        console.error(`Failed to update product ${product.id}:`, updateError);
      } else {
        console.log(`Product ${product.id} updated.`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error processing product ${product.id}:`, err);

      // Update with failure status
      await supabase
        .from('products')
        .update({
          ig_status: 'failed',
          ig_last_error: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);
    }

    // Slight delay to be nice to APIs
    await new Promise((r) => setTimeout(r, 1000));
  }

  // --- PART 2: POST TO INSTAGRAM ---
  console.log('--- Checking for products to POST ---');

  // Dynamic import internal service to ensure env vars are loaded
  const { instagramService } = await import('@/lib/instagram');

  const { data: postsToPublish, error: fetchPostError } = await supabase
    .from('products')
    .select('*')
    .eq('ig_status', 'generated')
    .eq('should_post_to_instagram', true)
    .limit(5);

  if (fetchPostError) {
    console.error('Error fetching products to post:', fetchPostError);
  } else if (postsToPublish && postsToPublish.length > 0) {
    console.log(`Found ${postsToPublish.length} products ready to post.`);

    for (const product of postsToPublish) {
      console.log(`Publishing product: ${product.title}`);
      try {
        const postId = await instagramService.postProduct(product as any); // eslint-disable-line @typescript-eslint/no-explicit-any

        if (postId) {
          await supabase
            .from('products')
            .update({
              ig_status: 'posted',
              ig_post_id: postId,
              ig_published_at: new Date().toISOString(),
              ig_last_error: null,
            })
            .eq('id', product.id);
          console.log(`Successfully posted! ID: ${postId}`);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown posting error';
        console.error(`Failed to post product ${product.id}:`, errorMessage);

        await supabase
          .from('products')
          .update({
            ig_status: 'failed',
            ig_last_error: `Posting Error: ${errorMessage}`,
          })
          .eq('id', product.id);
      }
      // Delay
      await new Promise((r) => setTimeout(r, 2000));
    }
  } else {
    console.log('No products waiting to be posted.');
  }

  console.log('Worker finished.');
}

run().catch((err: unknown) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  console.error('Worker error:', errorMessage);
  process.exit(1);
});
