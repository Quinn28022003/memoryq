 
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Generate Advanced Helper Functions for RLS
 *
 * This file generates PostgreSQL helper functions used by RLS (Row Level Security)
 * policies to check user permissions and access rights.
 *
 * Structure:
 * - rls-helpers/sql-utils.js: SQL generation utilities
 * - rls-helpers/drop-statements.js: Clean up existing functions
 * - rls-helpers/auth-functions.js: Core authentication functions
 * - rls-helpers/permission-functions.js: Permission checking functions
 * - rls-helpers/org-project-access.js: Organization & project access functions
 * - rls-helpers/resource-access.js: Resource-specific access functions
 */

// Register tsx to handle TypeScript files (if not already registered)
try {
  require('tsx/cjs');
} catch {
  // tsx may already be registered by parent script
}

// Import ERole enum
let ERole;
try {
  ({ ERole } = require('../../src/types/ERole'));
} catch (error) {
  // Fallback if not running in TS-aware environment or file not found
  ERole = { SuperAdmin: 'super_admin' };
}

// Import generators from sub-modules
const { generateDropStatements } = require('./rls-helpers/drop-statements');

const {
  generateIsSuperAdmin,
  generateIsOrganizationOwner,
} = require('./rls-helpers/auth-functions');

const {
  generateUserHasGlobalPermission,
  generateGetUserAllRoles,
  generateUserHasPermissionEnhanced,
  generateUserHasPermissionLegacy,
} = require('./rls-helpers/permission-functions');

const {
  generateUserHasOrgAccess,
  generateCheckOrgPermission,
  generateCheckProjectPermission,
  generateUserHasProjectAccess,
  generateUserHasProjectResourceAccess,
} = require('./rls-helpers/org-project-access');

const {
  generateUserHasAgentAccess,
  generateUserHasConversationAccess,
  generateUserHasToolAccess,
  generateUserHasTestSuiteAccess,
  generateUserHasKnowledgeHubAccess,
  generateUserHasDataSourceAccess,
  generateUserHasKnowledgeHubVersionAccess,
  generateUserHasAgentHubLinkAccess,
  generateUserHasAgentVersionResourceAccess,
} = require('./rls-helpers/resource-access');

/**
 * Generate advanced helper functions with proper role checking
 *
 * @returns {string} SQL string containing all helper function definitions
 */
function generateAdvancedHelperFunctions() {
  const SUPER_ADMIN = (ERole && ERole.SuperAdmin) || 'super_admin';

  // Collect all SQL parts in order
  const sqlParts = [
    // 1. Drop statements - Clean up existing functions
    generateDropStatements(),

    // 2. Core authentication functions
    generateIsSuperAdmin(SUPER_ADMIN),
    generateIsOrganizationOwner(),

    // 3. Permission checking functions
    generateUserHasGlobalPermission(),
    generateGetUserAllRoles(),
    generateUserHasPermissionEnhanced(),
    generateUserHasPermissionLegacy(),

    // 4. Organization & Project access functions
    generateUserHasOrgAccess(),
    generateCheckOrgPermission(),
    generateCheckProjectPermission(),
    generateUserHasProjectAccess(),
    generateUserHasProjectResourceAccess(),

    // 5. Resource-specific access functions
    generateUserHasAgentAccess(),
    generateUserHasConversationAccess(),
    generateUserHasToolAccess(),
    generateUserHasTestSuiteAccess(),
    generateUserHasKnowledgeHubAccess(),
    generateUserHasDataSourceAccess(),
    generateUserHasKnowledgeHubVersionAccess(),
    generateUserHasAgentHubLinkAccess(),
    generateUserHasAgentVersionResourceAccess(),
  ];

  return sqlParts.join('\n');
}

module.exports = {
  generateAdvancedHelperFunctions,
};
