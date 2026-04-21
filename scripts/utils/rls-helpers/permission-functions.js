/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Permission Checking Functions
 *
 * SQL generators for permission-related helper functions:
 * - user_has_global_permission: Check permission without org/project context
 * - get_user_all_roles: Get all roles for a user from all sources
 * - user_has_permission: Check if user has a specific permission (enhanced & legacy)
 */

const { createFunctionHeader, createFunctionFooter } = require('./sql-utils');

/**
 * Generate user_has_global_permission function
 * Checks if user has permission through internal_role (no org/project context)
 *
 * @returns {string} SQL function definition
 */
function generateUserHasGlobalPermission() {
  return `
-- ================================================
-- HELPER FUNCTION: Check permission without context (for INSERT operations)
-- ================================================
-- This function checks if user has permission through ANY of their roles:
-- 1. profiles.roles (system-wide)
-- 2. OR user has super_admin role (bypass ALL RLS checks)
-- No org/project context needed - useful for CREATE operations
${createFunctionHeader('user_has_global_permission', ['p_permission_key TEXT'], 'BOOLEAN')}
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

  -- Check if user has permission through internal_role
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.role_permissions rp ON rp.role_code = ANY(p.roles)
    WHERE p.id = current_user_id
    AND rp.permission_code = p_permission_key
  );
END;
${createFunctionFooter()}`;
}

/**
 * Generate get_user_all_roles function
 * Collects all roles from profiles, organization_members, and project_members
 *
 * @returns {string} SQL function definition
 */
function generateGetUserAllRoles() {
  return `
-- ================================================
-- HELPER FUNCTION: Get all roles for a user
-- ================================================
-- This function collects all roles from:
-- 1. profiles.roles (system-wide role)
-- 2. organization_members.role (organization role array)
-- 3. project_members.role (project role array)
${createFunctionHeader(
  'get_user_all_roles',
  ['p_user_id UUID', 'p_org_id UUID DEFAULT NULL', 'p_project_id UUID DEFAULT NULL'],
  'TABLE(role_key TEXT, role_source TEXT)',
)}
BEGIN
  -- Return internal role from profiles (system-wide)
  RETURN QUERY
  SELECT 
    UNNEST(p.roles) as role_key,
    'internal'::TEXT as role_source
  FROM public.profiles p
  WHERE p.id = p_user_id
  AND p.roles IS NOT NULL;

  -- Return organization roles if org_id is provided (role is now an array)
  IF p_org_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      UNNEST(om.role) as role_key,
      'organization'::TEXT as role_source
    FROM public.organization_members om
    WHERE om.user_id = p_user_id
    AND om.organization_id = p_org_id
    AND om.deleted_at IS NULL
    AND om.is_active = TRUE;
  END IF;

  -- Return project role if project_id is provided
  IF p_project_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      UNNEST(pm.role) as role_key,
      'project'::TEXT as role_source
    FROM public.project_members pm
    WHERE pm.organization_member_id IN (
      SELECT om.id 
      FROM public.organization_members om
      WHERE om.user_id = p_user_id
      AND om.deleted_at IS NULL
    )
    AND pm.project_id = p_project_id
    AND pm.deleted_at IS NULL
    AND pm.is_active = TRUE;
  END IF;

  RETURN;
END;
${createFunctionFooter()}`;
}

/**
 * Generate user_has_permission function (Enhanced version with project support)
 *
 * @returns {string} SQL function definition
 */
function generateUserHasPermissionEnhanced() {
  return `
-- ================================================
-- HELPER FUNCTION: Check if user has permission (Enhanced)
-- ================================================
-- This function checks permission by aggregating roles from:
-- 1. profiles.roles
-- 2. organization_members.role
-- 3. project_members.role (if project_id provided)
${createFunctionHeader(
  'user_has_permission',
  [
    'p_user_id UUID',
    'p_org_id UUID',
    'p_project_id UUID DEFAULT NULL',
    'p_permission_key TEXT DEFAULT NULL',
  ],
  'BOOLEAN',
)}
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  -- If no permission key specified, just check if user has any role
  IF p_permission_key IS NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.get_user_all_roles(p_user_id, p_org_id, p_project_id)
    );
  END IF;

  -- Check if any of the user's roles have this permission
  SELECT EXISTS (
    SELECT 1
    FROM public.get_user_all_roles(p_user_id, p_org_id, p_project_id) ur
    JOIN public.role_permissions rp ON rp.role_code = ur.role_key
    JOIN public.permissions perm ON perm.code = rp.permission_code
    WHERE rp.permission_code = p_permission_key
  ) INTO v_has_permission;

  RETURN v_has_permission;
END;
${createFunctionFooter()}`;
}

/**
 * Generate user_has_permission function (Legacy version for backward compatibility)
 *
 * @returns {string} SQL function definition
 */
function generateUserHasPermissionLegacy() {
  return `
-- ================================================
-- HELPER FUNCTION: Check if user has permission (Legacy - Org only)
-- ================================================
-- This is the old version for backward compatibility
-- Only checks organization role
${createFunctionHeader('user_has_permission', ['user_id UUID', 'org_id UUID', 'permission_key TEXT'], 'BOOLEAN')}
BEGIN
  -- Use the enhanced version with NULL project_id
  RETURN public.user_has_permission(user_id, org_id, NULL::UUID, permission_key);
END;
${createFunctionFooter()}`;
}

module.exports = {
  generateUserHasGlobalPermission,
  generateGetUserAllRoles,
  generateUserHasPermissionEnhanced,
  generateUserHasPermissionLegacy,
};
