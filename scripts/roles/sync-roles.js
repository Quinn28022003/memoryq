/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Role Sync Script
 *
 * This script syncs the roles defined in src/lib/permissions/data.ts
 * with the Supabase database. It will:
 * 1. Soft-delete roles from the database that are no longer in the source array
 * 2. Add new roles from the source array (skips roles that already exist, even if soft-deleted)
 * 3. Update role details (label, description) for existing ACTIVE roles only
 * 4. Sync role_permissions mappings for active roles
 * 5. IGNORE all soft-deleted roles (roles with deleted_at != null)
 *    - Soft-deleted roles are intentionally skipped and will NOT be restored
 *    - If you want to restore a role, manually set deleted_at to NULL in the database
 *
 * Usage: npm run sync:roles
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
const { createClient: createSupabaseClient } = require('../../src/lib/supabase/cli.ts');
const { ROLES } = require('../../src/lib/permissions/data.ts');

async function syncRoles() {
  let supabase;
  try {
    supabase = createSupabaseClient();
  } catch (error) {
    console.error(chalk.red('❌ Failed to create Supabase client:'));
    console.error(chalk.red(error.message));
    console.error(chalk.yellow(`\nMake sure environment variables are set in ${loadedEnvFile}`));
    process.exit(1);
  }

  console.log(chalk.blue('🔄 Starting role sync...\n'));
  console.log(chalk.gray(`Environment: ${isDev ? 'Development' : 'Production'}`));
  console.log(chalk.gray(`Config file: ${loadedEnvFile}\n`));

  try {
    // Step 1: Get ALL existing roles from the database (including soft-deleted ones)
    console.log(chalk.cyan('📥 Fetching all roles from database...'));
    const { data: allRoles, error: fetchError } = await supabase
      .from('roles')
      .select('code, label, description, deleted_at');

    if (fetchError) {
      throw new Error(`Failed to fetch roles: ${fetchError.message}`);
    }

    // Separate active and soft-deleted roles
    const activeRoles = allRoles?.filter((r) => r.deleted_at === null) || [];
    const deletedRoleCodes = new Set(
      allRoles?.filter((r) => r.deleted_at !== null).map((r) => r.code) || [],
    );

    const existingActiveCodes = new Set(activeRoles.map((r) => r.code));
    const newCodes = new Set(ROLES.map((r) => r.code));

    console.log(chalk.green(`✓ Found ${existingActiveCodes.size} active roles\n`));
    if (deletedRoleCodes.size > 0) {
      console.log(
        chalk.gray(`ℹ️  Found ${deletedRoleCodes.size} soft-deleted role(s) (will be skipped)\n`),
      );
    }

    // Step 2: Identify roles to soft-delete (only from active roles, not touching deleted ones)
    const toRemove = Array.from(existingActiveCodes).filter((code) => !newCodes.has(code));

    if (toRemove.length > 0) {
      console.log(chalk.yellow(`🗑️  Soft-deleting ${toRemove.length} obsolete role(s):`));
      toRemove.forEach((code) => console.log(chalk.gray(`   - ${code}`)));

      // Soft delete by setting deleted_at timestamp
      const { error: deleteError } = await supabase
        .from('roles')
        .update({ deleted_at: new Date().toISOString() })
        .in('code', toRemove);

      if (deleteError) {
        throw new Error(`Failed to soft-delete roles: ${deleteError.message}`);
      }
      console.log(chalk.green('✓ Soft-deleted obsolete roles\n'));
    } else {
      console.log(chalk.gray('✓ No obsolete roles to remove\n'));
    }

    // Step 3: Identify roles to add (exclude both active and soft-deleted roles)
    const allExistingCodes = new Set(allRoles?.map((r) => r.code) || []);
    const toAdd = ROLES.filter((r) => !allExistingCodes.has(r.code));

    if (toAdd.length > 0) {
      console.log(chalk.yellow(`➕ Adding ${toAdd.length} new role(s):`));
      toAdd.forEach((r) => console.log(chalk.gray(`   - ${r.code} (${r.label})`)));

      const rolesToInsert = toAdd.map((r) => ({
        code: r.code,
        label: r.label,
        description: r.description,
      }));

      const { error: insertError } = await supabase.from('roles').insert(rolesToInsert);

      if (insertError) {
        throw new Error(`Failed to insert roles: ${insertError.message}`);
      }
      console.log(chalk.green('✓ Added new roles\n'));
    } else {
      console.log(chalk.gray('✓ No new roles to add\n'));
    }

    // Step 4: Update existing active roles (in case labels or descriptions changed)
    // Note: We only update ACTIVE roles. Soft-deleted roles are intentionally ignored.
    const toUpdate = ROLES.filter((r) => existingActiveCodes.has(r.code));

    if (toUpdate.length > 0) {
      console.log(chalk.cyan(`🔄 Updating ${toUpdate.length} existing role(s)...`));

      for (const role of toUpdate) {
        const { error: updateError } = await supabase
          .from('roles')
          .update({
            label: role.label,
            description: role.description,
          })
          .eq('code', role.code);

        if (updateError) {
          throw new Error(`Failed to update role ${role.code}: ${updateError.message}`);
        }
      }
      console.log(chalk.green('✓ Updated existing roles\n'));
    }

    // Step 5: Sync role_permissions mappings
    console.log(chalk.cyan('🔗 Syncing role-permission mappings...'));

    let addedPermissions = 0;
    let removedPermissions = 0;

    for (const role of ROLES) {
      // Get existing permissions for this role
      const { data: existingRolePermissions, error: fetchRolePermError } = await supabase
        .from('role_permissions')
        .select('permission_code')
        .eq('role_code', role.code);

      if (fetchRolePermError) {
        throw new Error(
          `Failed to fetch permissions for role ${role.code}: ${fetchRolePermError.message}`,
        );
      }

      const existingPermissionCodes = new Set(
        existingRolePermissions?.map((rp) => rp.permission_code) || [],
      );
      const newPermissionCodes = new Set(role.permissions);

      // Remove outdated permissions
      const permissionsToRemove = Array.from(existingPermissionCodes).filter(
        (code) => !newPermissionCodes.has(code),
      );

      if (permissionsToRemove.length > 0) {
        const { error: deletePermError } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_code', role.code)
          .in('permission_code', permissionsToRemove);

        if (deletePermError) {
          throw new Error(
            `Failed to delete permissions for role ${role.code}: ${deletePermError.message}`,
          );
        }
        removedPermissions += permissionsToRemove.length;
      }

      // Add new permissions
      const permissionsToAdd = Array.from(newPermissionCodes).filter(
        (code) => !existingPermissionCodes.has(code),
      );

      if (permissionsToAdd.length > 0) {
        const rolePermissionsToInsert = permissionsToAdd.map((permCode) => ({
          role_code: role.code,
          permission_code: permCode,
        }));

        const { error: insertPermError } = await supabase
          .from('role_permissions')
          .insert(rolePermissionsToInsert);

        if (insertPermError) {
          throw new Error(
            `Failed to insert permissions for role ${role.code}: ${insertPermError.message}`,
          );
        }
        addedPermissions += permissionsToAdd.length;
      }
    }

    console.log(chalk.green('✓ Synced role-permission mappings\n'));

    // Step 6: Summary
    console.log(chalk.green.bold('✅ Role sync completed successfully!\n'));
    console.log(chalk.blue('📊 Summary:'));
    console.log(chalk.gray(`   Total roles in source: ${ROLES.length}`));
    console.log(chalk.gray(`   Added: ${toAdd.length}`));
    console.log(chalk.gray(`   Soft-deleted: ${toRemove.length}`));
    console.log(chalk.gray(`   Updated: ${toUpdate.length}`));
    if (deletedRoleCodes.size > 0) {
      console.log(chalk.gray(`   Ignored (soft-deleted in DB): ${deletedRoleCodes.size}`));
    }
    console.log(chalk.gray(`   Role-permissions added: ${addedPermissions}`));
    console.log(chalk.gray(`   Role-permissions removed: ${removedPermissions}`));
  } catch (error) {
    console.error(chalk.red('\n❌ Role sync failed:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

// Run the sync
syncRoles();
