/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Remove Roles Script
 *
 * Removes all roles from the database.
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

async function removeRoles() {
  const supabase = createSupabaseClient();
  console.log(chalk.red('🗑️  Removing ALL roles...'));

  // Delete all roles - filtering with neq to satisfy library requirement for delete
  const { error } = await supabase.from('roles').delete().neq('code', 'PLACEHOLDER');

  if (error) {
    console.error(chalk.red('Failed to delete roles:'), error.message);
    process.exit(1);
  }
  console.log(chalk.green('✓ Roles cleared.'));
}

removeRoles();
