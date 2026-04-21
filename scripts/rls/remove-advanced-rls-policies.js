/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Remove Advanced RLS Policies Script
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const isDev = process.env.NODE_ENV !== 'production';
const envFiles = isDev ? ['.env.local', '.env'] : ['.env.production', '.env'];

for (const envFile of envFiles) {
  const envPath = path.join(__dirname, '..', '..', envFile);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

require('tsx/cjs');
const { createClient: createSupabaseClient } = require('../../src/lib/supabase/cli.ts');
const { ADVANCED_RLS_CONFIG } = require('../../src/lib/permissions/data.ts');

async function removeAdvancedRls() {
  const supabase = createSupabaseClient();
  console.log(chalk.red('🗑️  Removing Advanced RLS Policies...'));

  for (const config of ADVANCED_RLS_CONFIG) {
    const table = config.table;
    const policies = [
      `Users can view ${table}`,
      `Users can insert ${table}`,
      `Users can update ${table}`,
      `Users can delete ${table}`,
      `Users can view ${table} they have access to`,
      `Anon can view ${table}`,
    ];

    // Drop policies
    const sql = policies.map((p) => `DROP POLICY IF EXISTS "${p}" ON public.${table};`).join('\n');

    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.log(chalk.yellow(`Warning dropping policies for ${table}: ${error.message}`));
    }
  }

  console.log(chalk.green('✓ Advanced RLS Policies removed.'));
}

removeAdvancedRls();
