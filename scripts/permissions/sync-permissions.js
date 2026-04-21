/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Permission Sync Script
 *
 * This script syncs the permissions defined in src/lib/permissions/index.ts
 * with the Supabase database. It will:
 * 1. Remove permissions from the database that are no longer in the array
 * 2. Add new permissions from the array
 * 3. Update descriptions for existing permissions
 *
 * Usage: npm run sync:permissions
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// __dirname is available in CommonJS
// Load environment variables from .env.local or .env
const isDev = process.env.NODE_ENV !== 'production';
const envFiles = isDev ? ['.env.local', '.env'] : ['.env.production', '.env'];

let envLoaded = false;
let loadedEnvFile = 'system environment';
for (const envFile of envFiles) {
  const envPath = path.join(__dirname, '..', '..', envFile);
  if (fs.existsSync(envPath)) {
    console.log(chalk.gray(`Loading environment from ${envFile}`));
    dotenv.config({ path: envPath });
    envLoaded = true;
    loadedEnvFile = envFile;
  }
}

if (!envLoaded) {
  console.log(chalk.yellow('⚠️  No .env file found, using system environment variables'));
}

// Register tsx to handle TypeScript files in CommonJS mode
require('tsx/cjs');

// Import TypeScript modules using require
// Use the CLI supabase client for scripts (replace script-client.ts)
const { createClient: createSupabaseClient } = require('../../src/lib/supabase/cli.ts');
const { PERMISSIONS_OBJECT } = require('../../src/lib/permissions/data.ts');

async function syncPermissions() {
  let supabase;
  try {
    supabase = createSupabaseClient();
  } catch (error) {
    console.error(chalk.red('❌ Failed to create Supabase client:'));
    console.error(chalk.red(error.message));
    console.error(chalk.yellow(`\nMake sure environment variables are set in ${loadedEnvFile}`));
    process.exit(1);
  }

  console.log(chalk.blue('🔄 Starting permission sync...\n'));
  console.log(chalk.gray(`Environment: ${isDev ? 'Development' : 'Production'}`));
  console.log(chalk.gray(`Config file: ${loadedEnvFile}\n`));

  try {
    // Step 1: Get all existing permissions from the database
    console.log(chalk.cyan('📥 Fetching existing permissions from database...'));
    const { data: existingPermissions, error: fetchError } = await supabase
      .from('permissions')
      .select('code, description');

    if (fetchError) {
      throw new Error(`Failed to fetch permissions: ${fetchError.message}`);
    }

    // Convert PERMISSIONS_OBJECT to flat array of permissions and dedupe by `code`
    const permissionsMap = new Map();
    for (const [, actions] of Object.entries(PERMISSIONS_OBJECT)) {
      for (const [, permissionObj] of Object.entries(actions)) {
        if (!permissionObj || !permissionObj.code) continue;

        // Keep the first occurrence for a given code; ignore duplicates
        if (!permissionsMap.has(permissionObj.code)) {
          permissionsMap.set(permissionObj.code, {
            code: permissionObj.code,
            description: permissionObj.description,
          });
        }
      }
    }

    const permissionsWithKeys = Array.from(permissionsMap.values());

    const existingKeys = new Set(existingPermissions?.map((p) => p.code) || []);
    const newKeys = new Set(permissionsWithKeys.map((p) => p.code));

    console.log(chalk.green(`✓ Found ${existingKeys.size} existing permissions\n`));

    // Step 2: Identify permissions to remove
    const toRemove = Array.from(existingKeys).filter((code) => !newKeys.has(code));

    if (toRemove.length > 0) {
      console.log(chalk.yellow(`🗑️  Removing ${toRemove.length} obsolete permission(s):`));
      toRemove.forEach((code) => console.log(chalk.gray(`   - ${code}`)));

      // First, check and remove related role_permissions to avoid foreign key constraint errors
      console.log(chalk.cyan('   Checking role_permissions table...'));
      // Note: role_permissions usually uses IDs, but if we need to clean up by code, we might need a join or subquery.
      // However, the DB schema has simple FKs. If we delete from permissions, CASCADE should handle it if set up.
      // The schema said: permission_id bigint references public.permissions(id) on delete cascade
      // So we can just delete the permission.

      const { error: deleteError } = await supabase
        .from('permissions')
        .delete()
        .in('code', toRemove);

      if (deleteError) {
        throw new Error(`Failed to delete permissions: ${deleteError.message}`);
      }
      console.log(chalk.green('✓ Removed obsolete permissions\n'));
    } else {
      console.log(chalk.gray('✓ No obsolete permissions to remove\n'));
    }

    // Step 3: Identify permissions to add
    const toAdd = permissionsWithKeys.filter((p) => !existingKeys.has(p.code));

    if (toAdd.length > 0) {
      console.log(chalk.yellow(`➕ Adding ${toAdd.length} new permission(s):`));
      toAdd.forEach((p) => console.log(chalk.gray(`   - ${p.code}`)));

      const { error: insertError } = await supabase.from('permissions').insert(toAdd);

      if (insertError) {
        throw new Error(`Failed to insert permissions: ${insertError.message}`);
      }
      console.log(chalk.green('✓ Added new permissions\n'));
    } else {
      console.log(chalk.gray('✓ No new permissions to add\n'));
    }

    // Step 4: Update existing permissions (only when description changed)
    // Build a map of existing permission code -> description for quick lookup
    const existingMap = new Map((existingPermissions || []).map((p) => [p.code, p.description]));

    // Only include permissions where the code exists and the description differs
    const toUpdate = permissionsWithKeys.filter((p) => {
      if (!existingMap.has(p.code)) return false;
      const existingDesc = existingMap.get(p.code);
      return (existingDesc ?? '') !== (p.description ?? '');
    });

    if (toUpdate.length > 0) {
      console.log(chalk.cyan(`🔄 Updating ${toUpdate.length} existing permission(s)...`));

      for (const permission of toUpdate) {
        const { error: updateError } = await supabase
          .from('permissions')
          .update({ description: permission.description })
          .eq('code', permission.code);

        if (updateError) {
          throw new Error(`Failed to update permission ${permission.code}: ${updateError.message}`);
        }
      }
      console.log(chalk.green('✓ Updated existing permissions\n'));
    }

    // Step 5: Summary
    console.log(chalk.green.bold('✅ Permission sync completed successfully!\n'));
    console.log(chalk.blue('📊 Summary:'));
    console.log(chalk.gray(`   Total permissions: ${permissionsWithKeys.length}`));
    console.log(chalk.gray(`   Added: ${toAdd.length}`));
    console.log(chalk.gray(`   Removed: ${toRemove.length}`));
    console.log(chalk.gray(`   Updated: ${toUpdate.length}`));
  } catch (error) {
    console.error(chalk.red('\n❌ Permission sync failed:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

// Run the sync
syncPermissions();
