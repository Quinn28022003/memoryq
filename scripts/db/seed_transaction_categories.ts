import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CATEGORIES_TO_ENSURE = [
  { name: 'Chi phí nhập hàng', type: 'expense', description: 'Chi phí nhập hàng hóa (Capital)' },
  { name: 'Điều chỉnh', type: 'expense', description: 'Điều chỉnh tăng chi phí' },
  {
    name: 'Điều chỉnh',
    type: 'income',
    description: 'Điều chỉnh giảm chi phí (Hoàn tiền/Thu nhập khác)',
  },
];

async function seedCategories() {
  console.log('Seeding transaction categories...');

  for (const cat of CATEGORIES_TO_ENSURE) {
    // Check if exists
    const { data: existing } = await supabase
      .from('transaction_categories')
      .select('id')
      .eq('name', cat.name)
      .eq('type', cat.type)
      .single();

    if (!existing) {
      console.log(`Creating category: ${cat.name} (${cat.type})`);
      const { error } = await supabase.from('transaction_categories').insert(cat);
      if (error) {
        console.error(`Error creating ${cat.name}:`, error.message);
      }
    } else {
      console.log(`Category exists: ${cat.name} (${cat.type})`);
    }
  }

  console.log('Done!');
}

seedCategories();
