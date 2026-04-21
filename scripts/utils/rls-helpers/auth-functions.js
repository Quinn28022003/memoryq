/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Core Authentication Functions
 *
 * SQL generators for authentication-related helper functions:
 * - is_super_admin: Check if current user has super_admin role
 * - is_organization_owner: Check if current user owns an organization
 */

const { createFunctionHeader, createFunctionFooter } = require('./sql-utils');

/**
 * Generate is_super_admin function
 * Checks if current user has super_admin role (bypasses RLS)
 *
 * @param {string} superAdminRole - The super admin role key
 * @returns {string} SQL function definition
 */
function generateIsSuperAdmin(superAdminRole) {
  return `
-- ================================================
-- HELPER FUNCTION: Check if current user is super_admin
-- ================================================
-- This function bypasses RLS to check if user has super_admin role
-- SECURITY DEFINER allows it to bypass RLS on profiles table
${createFunctionHeader('is_super_admin', [], 'BOOLEAN')}
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if user has super_admin role (bypasses RLS)
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = current_user_id
    AND '${superAdminRole}' = ANY(p.roles)
  );
END;
${createFunctionFooter()}`;
}

/**
 * Generate is_organization_owner function
 * Checks if current user is the owner of a specific organization
 *
 * @returns {string} SQL function definition
 */
function generateIsOrganizationOwner() {
  return `
-- ================================================
-- HELPER FUNCTION: Check if current user is organization owner
-- ================================================
-- This function checks if the current user is the owner of a specific organization
${createFunctionHeader('is_organization_owner', ['p_org_id UUID'], 'BOOLEAN')}
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- First check if user has super_admin role - bypass all checks
  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;

  -- Check if user is a member with 'organization_owner' role in this organization
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = current_user_id
    AND om.organization_id = p_org_id
    AND om.deleted_at IS NULL
    AND om.is_active = TRUE
    AND 'organization_owner' = ANY(om.role)
  );
END;
${createFunctionFooter()}`;
}

module.exports = {
  generateIsSuperAdmin,
  generateIsOrganizationOwner,
};
