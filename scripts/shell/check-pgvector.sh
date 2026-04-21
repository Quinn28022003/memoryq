#!/bin/bash
# ================================================
# Check if pgvector extension is enabled in Supabase
# ================================================

set -e

if [[ -z "$NEXT_PUBLIC_SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  echo "⚠️  WARNING: Missing Supabase credentials, skipping pgvector check"
  exit 0
fi

echo "🔍 Checking if pgvector extension is enabled..."

# Create a simple Node.js script to check pgvector
node -e "
const { createClient } = require('@supabase/supabase-js');

(async () => {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Query pg_extension to check for vector extension
    const { data, error } = await supabase
      .from('pg_extension')
      .select('extname, extversion')
      .eq('extname', 'vector')
      .maybeSingle();

    if (error) {
      // Try alternative method using raw SQL if pg_extension table is not accessible
      const { data: sqlData, error: sqlError } = await supabase.rpc('exec_sql', {
        sql: \"SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';\"
      });
      
      if (sqlError || !sqlData) {
        console.log('⚠️  WARNING: pgvector extension not found!');
        console.log('');
        console.log('📖 Please enable pgvector manually:');
        console.log('   1. Supabase Dashboard → Database → Extensions → Enable \"vector\"');
        console.log('      IMPORTANT: Select \"public\" schema (NOT \"extensions\" schema)');
        console.log('   2. Or run in SQL Editor: CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;');
        console.log('');
        console.log('   See MIGRATIONS.md for detailed instructions.');
        console.log('');
        console.log('⚠️  Migrations may fail if they require the vector type.');
        process.exit(1);
      }
    }

    if (!data) {
      console.log('⚠️  WARNING: pgvector extension not found!');
      console.log('');
      console.log('📖 Please enable pgvector manually in Supabase Dashboard:');
      console.log('   Database → Extensions → Enable \"vector\"');
      console.log('   IMPORTANT: Select \"public\" schema (NOT \"extensions\" schema)');
      console.log('');
      console.log('   Or run: CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;');
      console.log('');
      process.exit(1);
    } else {
      console.log(\`✅ pgvector extension is enabled (version: \${data.extversion || 'unknown'})\`);
      process.exit(0);
    }
  } catch (err) {
    console.log('⚠️  Failed to check pgvector extension:', err.message);
    console.log('   Continuing anyway...');
    process.exit(0);
  }
})();
"
