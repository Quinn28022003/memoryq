/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Remove Permissions Script
 *
 * Removes all permissions from the database.
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

async function removePermissions() {
  const supabase = createSupabaseClient();
  console.log(chalk.red('🗑️  Removing ALL permissions...'));

  const { error } = await supabase
    .from('permissions')
    .delete()
    .neq('code', 'PLACEHOLDER_TO_DELETE_ALL');
  // .delete() without filter might require specific config or might not be allowed safely.
  // But usually .delete().neq('id', 0) works or just .delete() if RLS allows.
  // With service_role, .delete().neq('code', 'xxx') is safe enough pattern to mean "all".
  // Actually, .delete() requires a filter in Supabase client usually.

  if (error) {
    console.error(chalk.red('Failed to delete permissions:'), error.message);
    process.exit(1);
  }
  console.log(chalk.green('✓ Permissions cleared.'));
}

removePermissions();
