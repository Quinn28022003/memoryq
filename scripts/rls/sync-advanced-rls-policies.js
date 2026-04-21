/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Advanced RLS Policy Sync Script
 *
 * This script creates proper role-based RLS policies using the RBAC system.
 * It generates helper functions that check against organization_members table
 * and use the proper role hierarchy.
 *
 * Usage: npm run sync:rls:advanced
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
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

// Register tsx to handle TypeScript files
require('tsx/cjs');

// Import roles and permissions
const { ROLES, ERlsCheckType } = require('../../src/lib/permissions/data');
const { createClient: createSupabaseClient } = require('../../src/lib/supabase/cli');
// Import RLS configuration
const { ADVANCED_RLS_CONFIG } = require('../../src/lib/permissions/data');
// Import SQL generation utilities
const { generateAdvancedHelperFunctions } = require('../utils/generateAdvancedHelperFunctions');

/**
 * Generate SQL script with advanced RLS policies
 */
function generateAdvancedSqlScript() {
  const helperFunctions = generateAdvancedHelperFunctions();

  const policiesSQL = ADVANCED_RLS_CONFIG.map((config) => {
    // Helper function to get access check based on checkType
    const getAccessCheck = (permissionKey, operation) => {
      // Handle special cases where permissionKey is null (public/user-owned resources)
      if (permissionKey === null) {
        switch (config.checkType) {
          case ERlsCheckType.PUBLIC_READ:
            return 'auth.uid() IS NOT NULL'; // Authenticated users
          case ERlsCheckType.USER_PROFILE:
            // Own profile only OR super_admin can view all
            return `(${config.accessParam} = auth.uid() OR public.is_super_admin())`;
          default:
            return 'TRUE'; // Fallback to public access
        }
      }

      // Allow operation-specific overrides
      const checkType =
        (operation === 'SELECT' && config.selectCheckType) ||
        (operation === 'INSERT' && config.insertCheckType) ||
        (operation === 'UPDATE' && config.updateCheckType) ||
        (operation === 'DELETE' && config.deleteCheckType) ||
        config.checkType;

      // Support both single accessParam and multiple accessParams
      // Operation-specific params take precedence
      let accessParam =
        (operation === 'SELECT' && config.selectAccessParam) ||
        (operation === 'INSERT' && config.insertAccessParam) ||
        (operation === 'UPDATE' && config.updateAccessParam) ||
        (operation === 'DELETE' && config.deleteAccessParam) ||
        config.accessParam;

      let accessParams =
        (operation === 'SELECT' && config.selectAccessParams) ||
        (operation === 'INSERT' && config.insertAccessParams) ||
        (operation === 'UPDATE' && config.updateAccessParams) ||
        (operation === 'DELETE' && config.deleteAccessParams) ||
        config.accessParams;

      // Build parameter list for function calls
      // If accessParams array exists, use it; otherwise use single accessParam
      const buildFunctionParams = (permKey) => {
        if (accessParams && Array.isArray(accessParams) && accessParams.length > 0) {
          // Multiple parameters: func(param1, param2, param3, 'permission')
          return `${accessParams.join(', ')}, '${permKey}'`;
        } else if (accessParam) {
          // Single parameter: func(param, 'permission')
          return `${accessParam}, '${permKey}'`;
        } else {
          // No parameters: func('permission')
          return `'${permKey}'`;
        }
      };

      switch (checkType) {
        case ERlsCheckType.PERMISSION_ONLY:
          // For INSERT on organizations - only check permission (no org context yet)
          return `public.user_has_global_permission(${buildFunctionParams(permissionKey).replace(/, '/, "'")})`; // Remove params, keep only permission

        case ERlsCheckType.ORGANIZATION_MEMBER:
          // For SELECT/UPDATE/DELETE on organizations - check org membership + permission
          return `public.check_org_permission(${buildFunctionParams(permissionKey)})`;

        case ERlsCheckType.ORGANIZATION_OWNER:
          // Check if user is organization owner
          return `public.is_organization_owner(${accessParam || (accessParams && accessParams[0]) || 'id'})`;

        case ERlsCheckType.ORGANIZATION_RESOURCE:
          // Special handling for organization_members INSERT to allow owner to add themselves
          if (config.table === 'organization_members' && operation === 'INSERT') {
            const orgParam = accessParam || (accessParams && accessParams[0]);
            return `(
            EXISTS (
              SELECT 1 FROM public.organizations o
              WHERE o.id = ${orgParam}
              AND o.owner_id = auth.uid()
            )
            OR public.check_org_permission(${buildFunctionParams(permissionKey)})
          )`;
          }

          // For resources under organization (tools, knowledge_hubs, etc.)
          return `public.check_org_permission(${buildFunctionParams(permissionKey)})`;

        case ERlsCheckType.PROJECT_MEMBER:
        case ERlsCheckType.PROJECT_RESOURCE:
          // For resources under project (agents, etc.) - check all: org + project + permission
          return `public.check_project_permission(${buildFunctionParams(permissionKey)})`;

        case ERlsCheckType.KNOWLEDGE_HUB_RESOURCE: {
          // For data_sources linked to knowledge hubs
          const khParam = accessParam || (accessParams && accessParams[0]);
          return `EXISTS (
            SELECT 1 FROM public.knowledge_hubs kh
            WHERE kh.id = ${khParam}
            AND public.check_org_permission(kh.organization_id, '${permissionKey}')
          )`;
        }

        case ERlsCheckType.KNOWLEDGE_HUB_VERSION: {
          // For knowledge_hub_versions table - use knowledge_hub_id directly to query knowledge_hubs
          // Note: Do NOT self-reference knowledge_hub_versions here as it causes infinite recursion
          const khvParam = accessParam || (accessParams && accessParams[0]);
          return `EXISTS (
            SELECT 1 FROM public.knowledge_hubs kh
            WHERE kh.id = ${khvParam}
            AND public.check_org_permission(kh.organization_id, '${permissionKey}')
          )`;
        }

        case ERlsCheckType.KNOWLEDGE_HUB_DATA_SOURCE_LINK: {
          const khdslParam = accessParam || (accessParams && accessParams[0]);
          return `EXISTS (
            SELECT 1 FROM public.knowledge_hub_versions khv
            JOIN public.knowledge_hubs kh ON kh.id = khv.knowledge_hub_id
            WHERE khv.id = ${khdslParam}
            AND public.check_org_permission(kh.organization_id, '${permissionKey}')
          )`;
        }

        case ERlsCheckType.DATA_SOURCE_VERSION: {
          const dsvParam = accessParam || (accessParams && accessParams[0]);
          return `EXISTS (
            SELECT 1 FROM public.data_sources ds
            JOIN public.knowledge_hubs kh ON kh.id = ds.knowledge_hubs_id
            WHERE ds.id = ${dsvParam}
            AND public.check_org_permission(kh.organization_id, '${permissionKey}')
          )`;
        }

        case ERlsCheckType.AGENT_RESOURCE:
        case ERlsCheckType.AGENT_VERSION:
        case ERlsCheckType.AGENT_TEST_SUITE: {
          const agentParam = accessParam || (accessParams && accessParams[0]);
          return `EXISTS (
            SELECT 1 FROM public.agents a
            WHERE a.id = ${agentParam}
            AND public.check_project_permission(a.project_id, '${permissionKey}')
          )`;
        }

        case ERlsCheckType.AGENT_VERSION_RESOURCE: {
          const avParam = accessParam || (accessParams && accessParams[0]);
          return `EXISTS (
            SELECT 1 FROM public.agent_versions av
            JOIN public.agents a ON a.id = av.agent_id
            WHERE av.id = ${avParam}
            AND public.check_project_permission(a.project_id, '${permissionKey}')
          )`;
        }

        case ERlsCheckType.AGENT_HUB_DATA_SOURCE_LINK: {
          const ahdslParam = accessParam || (accessParams && accessParams[0]);
          return `EXISTS (
            SELECT 1 FROM public.agent_hub_links ahl
            JOIN public.agent_versions av ON av.id = ahl.agent_version_id
            JOIN public.agents a ON a.id = av.agent_id
            WHERE ahl.id = ${ahdslParam}
            AND public.check_project_permission(a.project_id, '${permissionKey}')
          )`;
        }

        case ERlsCheckType.CONVERSATION_OWNER: {
          // For conversations table - org members can access (SELECT/INSERT)
          // For UPDATE/DELETE - creator OR members with agent.update/agent.delete permission
          if (config.table === 'conversations') {
            // For conversations table, use org-scoped access
            // SELECT/INSERT: org membership (permission check done at API level)
            // UPDATE/DELETE: org membership + specific permission (agent.update/agent.delete)
            return `public.user_has_conversation_access(id)`;
          } else {
            // For conversation_messages table - check via conversation
            const convParam = accessParam || (accessParams && accessParams[0]);
            return `public.user_has_conversation_access(${convParam})`;
          }
        }

        case ERlsCheckType.CONVERSATION_MESSAGE: {
          const cmParam = accessParam || (accessParams && accessParams[0]);
          return `EXISTS (
            SELECT 1 FROM public.conversations c
            LEFT JOIN public.agents a ON a.id = c.agent_id
            WHERE c.id = ${cmParam}
            AND (c.created_by = auth.uid() OR public.check_project_permission(a.project_id, '${permissionKey}'))
          )`;
        }

        case ERlsCheckType.TOOL_INVOCATION:
        case ERlsCheckType.TOOL_SECRET: {
          const toolParam = accessParam || (accessParams && accessParams[0]);
          return `EXISTS (
            SELECT 1 FROM public.tools t
            WHERE t.id = ${toolParam}
            AND public.check_org_permission(t.organization_id, '${permissionKey}')
          )`;
        }

        case ERlsCheckType.PERMISSION:
          return `public.user_has_global_permission('${permissionKey}')`;

        case ERlsCheckType.AGENT_TEST_CASE: {
          const atcParam = accessParam || (accessParams && accessParams[0]);
          return `EXISTS (
            SELECT 1 FROM public.agent_test_suites ats
            JOIN public.agents a ON a.id = ats.agent_id
            WHERE ats.id = ${atcParam}
            AND public.check_project_permission(a.project_id, '${permissionKey}')
          )`;
        }

        case ERlsCheckType.PUBLIC_READ:
          return 'auth.uid() IS NOT NULL';

        case ERlsCheckType.AUTHENTICATED_ONLY:
          // For resources accessible to any authenticated user with the permission
          // Use global permission check (no org context required)
          return `public.user_has_global_permission('${permissionKey}')`;

        case ERlsCheckType.USER_PROFILE: {
          const profileParam = accessParam || (accessParams && accessParams[0]);
          // Allow users to view their own profile OR super_admin can view all
          return `(${profileParam} = auth.uid() OR public.is_super_admin())`;
        }

        case ERlsCheckType.SERVICE_ROLE_ONLY:
          // Only service_role can access - use auth.role() check
          return `(auth.role() = 'service_role')`;

        case ERlsCheckType.AGENT_VERSION_TOOL: {
          // For agent_tools table - check access via agent_version -> agent -> project
          const avtParam = accessParam || (accessParams && accessParams[0]);
          return `EXISTS (
            SELECT 1 FROM public.agent_versions av
            JOIN public.agents a ON a.id = av.agent_id
            WHERE av.id = ${avtParam}
            AND public.check_project_permission(a.project_id, '${permissionKey}')
          )`;
        }

        case ERlsCheckType.PUBLIC_CONVERSATION_RESOURCE: {
          // For resources linked to public_conversations - check via agent
          const pcrParam = accessParam || (accessParams && accessParams[0]);
          return `EXISTS (
            SELECT 1 FROM public.public_conversations pc
            JOIN public.agents a ON a.id = pc.agent_id
            WHERE pc.id = ${pcrParam}
            AND public.check_project_permission(a.project_id, '${permissionKey}')
          )`;
        }

        case ERlsCheckType.SUPER_ADMIN:
          // Only super_admin can access
          return `public.is_super_admin()`;

        case ERlsCheckType.MODEL_CATALOG:
          // For SELECT: authenticated users can see active models, super_admin can see all (including inactive)
          // Note: For INSERT/UPDATE/DELETE, this should be overridden with SUPER_ADMIN_ONLY
          return `((is_active = true AND auth.uid() IS NOT NULL) OR public.is_super_admin())`;

        default:
          return `public.check_org_permission(${buildFunctionParams(permissionKey)})`;
      }
    };

    // Generate soft-delete filter if excludeSoftDeleted is true
    // Super admins can see soft-deleted rows for recovery purposes
    const softDeleteFilter = config.excludeSoftDeleted
      ? `(deleted_at IS NULL OR public.is_super_admin())`
      : null;

    // Handle selectPermissions array (OR logic - any permission passes)
    let selectAccessCheck;
    if (
      config.selectPermissions &&
      Array.isArray(config.selectPermissions) &&
      config.selectPermissions.length > 0
    ) {
      // Generate OR condition: (check_perm_1 OR check_perm_2 OR ...)
      const orChecks = config.selectPermissions.map((perm) => getAccessCheck(perm, 'SELECT'));
      selectAccessCheck = `(${orChecks.join(' OR ')})`;
    } else {
      selectAccessCheck = getAccessCheck(config.permissions.select, 'SELECT');
    }

    // Combine access check with soft-delete filter for SELECT
    const selectCheck = softDeleteFilter
      ? `(${selectAccessCheck} AND ${softDeleteFilter})`
      : selectAccessCheck;

    // For UPDATE on soft-deleted rows, only super_admin can update (for recovery)
    const updateCheck = softDeleteFilter
      ? `((${getAccessCheck(config.permissions.update, 'UPDATE')} AND deleted_at IS NULL) OR public.is_super_admin())`
      : getAccessCheck(config.permissions.update, 'UPDATE');

    // Generate anon SELECT policy if allowAnonSelect is true
    const anonSelectPolicy = config.allowAnonSelect
      ? `
-- Drop existing anon policy if exists
DROP POLICY IF EXISTS "Anon can view ${config.table}" ON public.${config.table};

-- Create SELECT policy for anonymous users (for embed verification)
CREATE POLICY "Anon can view ${config.table}"
  ON public.${config.table}
  FOR SELECT
  TO anon
  USING (${softDeleteFilter ? `deleted_at IS NULL` : 'true'});
`
      : '';

    // Generate anon grant if allowAnonSelect is true
    const anonGrant = config.allowAnonSelect
      ? `GRANT SELECT ON public.${config.table} TO anon;\n`
      : '';

    return `-- Table: ${config.table}
-- ${config.description}
-- Permissions: SELECT=${config.permissions.select}, INSERT=${config.permissions.insert}, UPDATE=${config.permissions.update}, DELETE=${config.permissions.delete}${config.allowAnonSelect ? '\n-- AllowAnonSelect: true (anonymous users can SELECT for embed verification)' : ''}${config.excludeSoftDeleted ? '\n-- ExcludeSoftDeleted: true (soft-deleted rows hidden from normal users, super_admin can see for recovery)' : ''}
ALTER TABLE public.${config.table} ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view ${config.table}" ON public.${config.table};
DROP POLICY IF EXISTS "Users can insert ${config.table}" ON public.${config.table};
DROP POLICY IF EXISTS "Users can update ${config.table}" ON public.${config.table};
DROP POLICY IF EXISTS "Users can delete ${config.table}" ON public.${config.table};
DROP POLICY IF EXISTS "Users can view ${config.table} they have access to" ON public.${config.table};
DROP POLICY IF EXISTS "Authenticated users can manage ${config.table}" ON public.${config.table};

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view ${config.table}"
  ON public.${config.table}
  FOR SELECT
  USING (${selectCheck});
${anonSelectPolicy}
-- Create INSERT policy
CREATE POLICY "Users can insert ${config.table}"
  ON public.${config.table}
  FOR INSERT
  WITH CHECK (${getAccessCheck(config.permissions.insert, 'INSERT')});

-- Create UPDATE policy
CREATE POLICY "Users can update ${config.table}"
  ON public.${config.table}
  FOR UPDATE
  USING (${updateCheck})
  WITH CHECK (${updateCheck});

-- Create DELETE policy
CREATE POLICY "Users can delete ${config.table}"
  ON public.${config.table}
  FOR DELETE
  USING (${getAccessCheck(config.permissions.delete, 'DELETE')});

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.${config.table} TO authenticated;
${anonGrant}GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

`;
  }).join('');

  const rolesInfo = ROLES.map(
    (role) =>
      `-- ${role.code}: ${role.label}
--   ${role.description}
--   Permissions: ${role.permissions.length}
--`,
  ).join('\n');

  return `-- ================================================
-- ADVANCED RLS POLICY SYNC SCRIPT (Role-Based)
-- Generated at: ${new Date().toISOString()}
-- 
-- This script implements proper role-based access control
-- using the organization_members and role_permissions tables.
-- ================================================

-- ================================================
-- SECTION 1: CREATE HELPER FUNCTIONS
-- ================================================
${helperFunctions}

-- ================================================
-- SECTION 2: ENABLE RLS AND CREATE POLICIES
-- ================================================

${policiesSQL}

-- ================================================
-- SECTION 3: ROLE INFORMATION (For Reference)
-- ================================================
-- The following roles are defined in the system:
--
${rolesInfo}
`;
}

/**
 * Execute SQL using Supabase client directly (same pattern as sync-roles.js)
 * This executes the entire SQL script as a single query
 */
async function executeSqlDirectly(sql) {
  let supabase;

  try {
    supabase = createSupabaseClient();
  } catch (error) {
    console.log(chalk.red('❌ Failed to create Supabase client:'));
    console.log(chalk.red(error.message));
    return false;
  }

  console.log(chalk.blue('Executing SQL via Supabase client...\n'));

  try {
    // Execute the entire SQL script using .rpc with exec_sql function
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error(chalk.red('❌ Error executing SQL:'));
      console.error(chalk.red(error.message));
      if (error.details) {
        console.error(chalk.gray('\nDetails:'));
        console.error(chalk.gray(error.details));
      }
      if (error.hint) {
        console.error(chalk.gray('\nHint:'));
        console.error(chalk.gray(error.hint));
      }
      return false;
    }

    console.log(chalk.green('✓ SQL executed successfully\n'));
    return true;
  } catch (error) {
    console.error(chalk.red('❌ Error executing SQL:'));
    console.error(chalk.red(error.message));
    return false;
  }
}

/**
 * Main sync function
 */
async function syncAdvancedRlsPolicies() {
  console.log(chalk.blue('🔄 Starting Advanced RLS policy sync (Role-Based)...\n'));
  console.log(chalk.gray(`Environment: ${isDev ? 'Development' : 'Production'}`));
  console.log(chalk.gray(`Config file: ${loadedEnvFile}\n`));

  try {
    // Generate SQL script
    console.log(chalk.blue('📝 Generating advanced SQL script...'));
    const sql = generateAdvancedSqlScript();

    console.log(chalk.green(`✓ Generated helper functions with role-based access control`));
    console.log(
      chalk.green(
        `✓ Generated ${ADVANCED_RLS_CONFIG.length * 4} RLS policies (4 per table: SELECT, INSERT, UPDATE, DELETE)`,
      ),
    );
    console.log(chalk.green(`✓ Integrated with ${ROLES.length} system roles`));
    console.log(chalk.green(`✓ Total SQL lines: ${sql.split('\n').length}\n`));

    // Save SQL to file for reference
    const outputFile = path.join(__dirname, 'generated-advanced-rls-policies.sql');
    fs.writeFileSync(outputFile, sql);
    console.log(chalk.green(`✓ SQL script saved to: ${outputFile}\n`));

    // Execute SQL directly via Supabase client (same pattern as sync-roles.js)
    console.log(chalk.blue('🚀 Executing SQL via Supabase client...\n'));
    const executed = await executeSqlDirectly(sql);

    if (executed) {
      console.log(chalk.blue('\n' + '='.repeat(60)));
      console.log(chalk.blue('📊 Advanced RLS Policy Sync Summary'));
      console.log(chalk.blue('='.repeat(60)));
      console.log(chalk.green(`✓ Role-based helper functions created`));
      console.log(chalk.green(`✓ Tables with RLS enabled: ${ADVANCED_RLS_CONFIG.length}`));
      console.log(
        chalk.green(
          `✓ Policies created: ${ADVANCED_RLS_CONFIG.length * 4} (SELECT, INSERT, UPDATE, DELETE per table)`,
        ),
      );
      console.log(chalk.green(`✓ Integrated with ${ROLES.length} system roles`));
      console.log(chalk.blue('='.repeat(60) + '\n'));
      console.log(chalk.green('✅ All advanced RLS policies synced successfully!\n'));
    } else {
      console.log(chalk.blue('\n' + '='.repeat(60)));
      console.log(chalk.blue('📊 Advanced RLS Policy Sync Summary'));
      console.log(chalk.blue('='.repeat(60)));
      console.log(chalk.green(`✓ SQL script generated successfully`));
      console.log(chalk.yellow(`⚠️  Could not execute SQL automatically`));
      console.log(chalk.cyan(`\n💡 To apply the policies manually:`));
      console.log(chalk.gray(`   1. Open Supabase SQL Editor`));
      console.log(chalk.gray(`   2. Copy content from: ${outputFile}`));
      console.log(chalk.gray(`   3. Execute the SQL\n`));
      console.log(chalk.blue('='.repeat(60) + '\n'));
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Error during advanced RLS policy sync:'));
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

// Run the sync
syncAdvancedRlsPolicies();
