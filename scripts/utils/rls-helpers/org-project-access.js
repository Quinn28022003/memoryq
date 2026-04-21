/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Organization & Project Access Functions
 *
 * SQL generators for organization and project access checking:
 * - user_has_org_access: Check if user is a member of an organization
 * - check_org_permission: Check org membership + permission
 * - check_project_permission: Check project membership + permission
 * - user_has_project_access: Check if user has access to a project
 * - user_has_project_resource_access: Check project resource access with permission
 */

const { createFunctionHeader, createFunctionFooter } = require('./sql-utils');

/**
 * Generate user_has_org_access function
 *
 * @returns {string} SQL function definition
 */
function generateUserHasOrgAccess() {
  return `
-- ================================================
-- HELPER FUNCTION: Check organization access
-- ================================================
${createFunctionHeader('user_has_org_access', ['org_id UUID'], 'BOOLEAN')}
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is a member of the organization
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = current_user_id
    AND organization_id = org_id
    AND deleted_at IS NULL
  );
END;
${createFunctionFooter()}`;
}

/**
 * Generate check_org_permission function
 * Combines membership check with permission check
 *
 * @returns {string} SQL function definition
 */
function generateCheckOrgPermission() {
  return `
-- ================================================
-- HELPER FUNCTION: Check organization permission (combines membership + permission)
-- ================================================
-- This function checks BOTH:
-- 1. User is member of the organization
-- 2. User has the required permission in that org
-- 3. OR user has global permission via profiles.roles
-- 4. OR user has super_admin role (bypass ALL RLS checks)
${createFunctionHeader('check_org_permission', ['p_org_id UUID', 'p_permission_key TEXT'], 'BOOLEAN')}
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

  -- Check both membership AND permission in one query (role is now an array)
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.role_permissions rp ON rp.role_key = ANY(om.role)
    WHERE om.user_id = current_user_id
    AND om.organization_id = p_org_id
    AND om.deleted_at IS NULL
    AND om.is_active = TRUE
    AND rp.permission_key = p_permission_key
  )
  OR
  -- Also check profiles.roles
  EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.role_permissions rp ON rp.role_key = ANY(p.roles)
    WHERE p.id = current_user_id
    AND rp.permission_key = p_permission_key
  );
END;
${createFunctionFooter()}`;
}

/**
 * Generate check_project_permission function
 * Combines org + project membership + permission check
 *
 * @returns {string} SQL function definition
 */
function generateCheckProjectPermission() {
  return `
-- ================================================
-- HELPER FUNCTION: Check project permission (combines org + project membership + permission)
-- ================================================
-- This function checks ALL:
-- 1. Project belongs to an organization
-- 2. User is member of that organization  
-- 3. User is member of the project (optional)
-- 4. User has the required permission
-- 5. OR user has global permission via profiles.roles
-- 6. OR user has super_admin role (bypass ALL RLS checks)
${createFunctionHeader('check_project_permission', ['p_project_id UUID', 'p_permission_key TEXT'], 'BOOLEAN')}
DECLARE
  current_user_id UUID;
  v_org_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- First check if user has super_admin role - bypass all checks
  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;

  -- Get org_id from project
  SELECT organization_id INTO v_org_id
  FROM public.projects
  WHERE id = p_project_id;

  IF v_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if user has permission through:
  -- 1. Organization role (array)
  -- 2. Project role (array)
  -- 3. System-wide role (profiles.roles)
  RETURN EXISTS (
    -- Check org member with permission (role is now an array)
    SELECT 1
    FROM public.organization_members om
    JOIN public.role_permissions rp ON rp.role_key = ANY(om.role)
    WHERE om.user_id = current_user_id
    AND om.organization_id = v_org_id
    AND om.deleted_at IS NULL
    AND om.is_active = TRUE
    AND rp.permission_key = p_permission_key
  )
  OR EXISTS (
    -- Check project member with permission  
    SELECT 1
    FROM public.project_members pm
    JOIN public.organization_members om ON om.id = pm.organization_member_id
    JOIN public.role_permissions rp ON rp.role_key = ANY(pm.role)
    WHERE om.user_id = current_user_id
    AND pm.project_id = p_project_id
    AND pm.deleted_at IS NULL
    AND pm.is_active = TRUE
    AND rp.permission_key = p_permission_key
  )
  OR EXISTS (
    -- Check system-wide role
    SELECT 1
    FROM public.profiles p
    JOIN public.role_permissions rp ON rp.role_key = ANY(p.roles)
    WHERE p.id = current_user_id
    AND rp.permission_key = p_permission_key
  );
END;
${createFunctionFooter()}`;
}

/**
 * Generate user_has_project_access function
 *
 * @returns {string} SQL function definition
 */
function generateUserHasProjectAccess() {
  return `
-- ================================================
-- HELPER FUNCTION: Check project access
-- ================================================
${createFunctionHeader('user_has_project_access', ['project_id UUID'], 'BOOLEAN')}
DECLARE
  current_user_id UUID;
  proj_org_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get the organization_id for the project
  SELECT organization_id INTO proj_org_id
  FROM public.projects
  WHERE id = project_id;
  
  IF proj_org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user has access to the organization
  RETURN public.user_has_org_access(proj_org_id);
END;
${createFunctionFooter()}`;
}

/**
 * Generate user_has_project_resource_access function
 *
 * @returns {string} SQL function definition
 */
function generateUserHasProjectResourceAccess() {
  return `
-- ================================================
-- HELPER FUNCTION: Check project resource access
-- ================================================
${createFunctionHeader(
  'user_has_project_resource_access',
  ['resource_project_id UUID', 'permission_key TEXT'],
  'BOOLEAN',
)}
DECLARE
  current_user_id UUID;
  proj_org_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get the organization_id for the project
  SELECT organization_id INTO proj_org_id
  FROM public.projects
  WHERE id = resource_project_id;
  
  IF proj_org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user has the required permission in the organization
  RETURN public.user_has_permission(current_user_id, proj_org_id, permission_key);
END;
${createFunctionFooter()}`;
}

module.exports = {
  generateUserHasOrgAccess,
  generateCheckOrgPermission,
  generateCheckProjectPermission,
  generateUserHasProjectAccess,
  generateUserHasProjectResourceAccess,
};
