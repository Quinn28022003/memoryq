-- ================================================
-- ADVANCED RLS POLICY SYNC SCRIPT (Role-Based)
-- Generated at: 2026-02-27T23:29:06.710Z
-- 
-- This script implements proper role-based access control
-- using the organization_members and role_permissions tables.
-- ================================================

-- ================================================
-- SECTION 1: CREATE HELPER FUNCTIONS
-- ================================================
-- Drop existing helper functions first to avoid conflicts
DROP FUNCTION IF EXISTS public.user_has_permission(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_permission(UUID, UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_all_roles(UUID, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_org_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_project_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_project_resource_access(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_agent_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_conversation_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_tool_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_test_suite_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_knowledge_hub_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_data_source_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_knowledge_hub_version_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_agent_hub_link_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_agent_version_resource_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_global_permission(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.check_org_permission(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.check_project_permission(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_organization_owner(UUID) CASCADE;

-- ================================================
-- HELPER FUNCTION: Check if current user is super_admin
-- ================================================
-- This function bypasses RLS to check if user has super_admin role
-- SECURITY DEFINER allows it to bypass RLS on profiles table
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
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
    AND 'super_admin' = ANY(p.roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check if current user is organization owner
-- ================================================
-- This function checks if the current user is the owner of a specific organization
CREATE OR REPLACE FUNCTION public.is_organization_owner(
  p_org_id UUID
)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check permission without context (for INSERT operations)
-- ================================================
-- This function checks if user has permission through ANY of their roles:
-- 1. profiles.roles (system-wide)
-- 2. OR user has super_admin role (bypass ALL RLS checks)
-- No org/project context needed - useful for CREATE operations
CREATE OR REPLACE FUNCTION public.user_has_global_permission(
  p_permission_key TEXT
)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Get all roles for a user
-- ================================================
-- This function collects all roles from:
-- 1. profiles.roles (system-wide role)
-- 2. organization_members.role (organization role array)
-- 3. project_members.role (project role array)
CREATE OR REPLACE FUNCTION public.get_user_all_roles(
  p_user_id UUID,
  p_org_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL
)
RETURNS TABLE(role_key TEXT, role_source TEXT) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check if user has permission (Enhanced)
-- ================================================
-- This function checks permission by aggregating roles from:
-- 1. profiles.roles
-- 2. organization_members.role
-- 3. project_members.role (if project_id provided)
CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id UUID,
  p_org_id UUID,
  p_project_id UUID DEFAULT NULL,
  p_permission_key TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check if user has permission (Legacy - Org only)
-- ================================================
-- This is the old version for backward compatibility
-- Only checks organization role
CREATE OR REPLACE FUNCTION public.user_has_permission(
  user_id UUID,
  org_id UUID,
  permission_key TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Use the enhanced version with NULL project_id
  RETURN public.user_has_permission(user_id, org_id, NULL::UUID, permission_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check organization access
-- ================================================
CREATE OR REPLACE FUNCTION public.user_has_org_access(
  org_id UUID
)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check organization permission (combines membership + permission)
-- ================================================
-- This function checks BOTH:
-- 1. User is member of the organization
-- 2. User has the required permission in that org
-- 3. OR user has global permission via profiles.roles
-- 4. OR user has super_admin role (bypass ALL RLS checks)
CREATE OR REPLACE FUNCTION public.check_org_permission(
  p_org_id UUID,
  p_permission_key TEXT
)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

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
CREATE OR REPLACE FUNCTION public.check_project_permission(
  p_project_id UUID,
  p_permission_key TEXT
)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check project access
-- ================================================
CREATE OR REPLACE FUNCTION public.user_has_project_access(
  project_id UUID
)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check project resource access
-- ================================================
CREATE OR REPLACE FUNCTION public.user_has_project_resource_access(
  resource_project_id UUID,
  permission_key TEXT
)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check agent access
-- ================================================
CREATE OR REPLACE FUNCTION public.user_has_agent_access(
  agent_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  agent_project_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get the project_id for the agent
  SELECT project_id INTO agent_project_id
  FROM public.agents
  WHERE id = agent_id;
  
  IF agent_project_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check project access
  RETURN public.user_has_project_access(agent_project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check conversation access (org-scoped)
-- ================================================
CREATE OR REPLACE FUNCTION public.user_has_conversation_access(
  conversation_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  conv_agent_id UUID;
  agent_project_id UUID;
  project_org_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get conversation's agent and traverse to organization
  SELECT a.id, a.project_id, p.organization_id 
  INTO conv_agent_id, agent_project_id, project_org_id
  FROM public.conversations c
  INNER JOIN public.agents a ON a.id = c.agent_id AND a.deleted_at IS NULL
  INNER JOIN public.projects p ON p.id = a.project_id AND p.deleted_at IS NULL
  WHERE c.id = conversation_id
    AND c.deleted_at IS NULL;
  
  -- If conversation/agent/project not found or deleted, deny access
  IF project_org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is member of the organization
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = project_org_id
      AND om.user_id = current_user_id
      AND om.deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check tool access
-- ================================================
CREATE OR REPLACE FUNCTION public.user_has_tool_access(
  tool_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  tool_org_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get the organization_id for the tool
  SELECT organization_id INTO tool_org_id
  FROM public.tools
  WHERE id = tool_id;
  
  IF tool_org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check organization access
  RETURN public.user_has_org_access(tool_org_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check test suite access
-- ================================================
CREATE OR REPLACE FUNCTION public.user_has_test_suite_access(
  test_suite_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  parent_id UUID;
BEGIN
  -- Get the parent ID from the source table
  SELECT agent_id INTO parent_id
  FROM public.agent_test_suites
  WHERE id = test_suite_id;
  
  -- Check if user has access to the parent
  RETURN public.user_has_agent_access(parent_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check knowledge hub access via hub
-- ================================================
CREATE OR REPLACE FUNCTION public.user_has_knowledge_hub_access(
  hub_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  hub_org_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get the organization_id for the knowledge hub
  SELECT organization_id INTO hub_org_id
  FROM public.knowledge_hubs
  WHERE id = hub_id;
  
  IF hub_org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check organization access
  RETURN public.user_has_org_access(hub_org_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check data source access via source
-- ================================================
CREATE OR REPLACE FUNCTION public.user_has_data_source_access(
  source_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  source_hub_id UUID;
BEGIN
  -- Get the knowledge_hub_id for the data source
  SELECT knowledge_hubs_id INTO source_hub_id
  FROM public.data_sources
  WHERE id = source_id;
  
  -- Check if user has access to the knowledge hub
  RETURN public.user_has_knowledge_hub_access(source_hub_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check knowledge hub version access
-- ================================================
CREATE OR REPLACE FUNCTION public.user_has_knowledge_hub_version_access(
  version_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  parent_id UUID;
BEGIN
  -- Get the parent ID from the source table
  SELECT knowledge_hub_id INTO parent_id
  FROM public.knowledge_hub_versions
  WHERE id = version_id;
  
  -- Check if user has access to the parent
  RETURN public.user_has_knowledge_hub_access(parent_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check agent hub link access
-- ================================================
CREATE OR REPLACE FUNCTION public.user_has_agent_hub_link_access(
  link_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  link_agent_version_id UUID;
  link_agent_id UUID;
BEGIN
  -- Get the agent_version_id from the agent_hub_link
  SELECT agent_version_id INTO link_agent_version_id
  FROM public.agent_hub_links
  WHERE id = link_id;
  
  -- Get the agent_id from the agent_version
  SELECT agent_id INTO link_agent_id
  FROM public.agent_versions
  WHERE id = link_agent_version_id;
  
  -- Check if user has access to the agent
  RETURN public.user_has_agent_access(link_agent_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- HELPER FUNCTION: Check agent version resource access
-- ================================================
CREATE OR REPLACE FUNCTION public.user_has_agent_version_resource_access(
  version_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  parent_id UUID;
BEGIN
  -- Get the parent ID from the source table
  SELECT agent_id INTO parent_id
  FROM public.agent_versions
  WHERE id = version_id;
  
  -- Check if user has access to the parent
  RETURN public.user_has_agent_access(parent_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- SECTION 2: ENABLE RLS AND CREATE POLICIES
-- ================================================

-- Table: products
-- Products table
-- Permissions: SELECT=Product.list, INSERT=Product.create, UPDATE=Product.update, DELETE=Product.delete
-- AllowAnonSelect: true (anonymous users can SELECT for embed verification)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view products" ON public.products;
DROP POLICY IF EXISTS "Users can insert products" ON public.products;
DROP POLICY IF EXISTS "Users can update products" ON public.products;
DROP POLICY IF EXISTS "Users can delete products" ON public.products;
DROP POLICY IF EXISTS "Users can view products they have access to" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can manage products" ON public.products;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view products"
  ON public.products
  FOR SELECT
  USING (public.user_has_global_permission('Product.list'));

-- Drop existing anon policy if exists
DROP POLICY IF EXISTS "Anon can view products" ON public.products;

-- Create SELECT policy for anonymous users (for embed verification)
CREATE POLICY "Anon can view products"
  ON public.products
  FOR SELECT
  TO anon
  USING (true);

-- Create INSERT policy
CREATE POLICY "Users can insert products"
  ON public.products
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Product.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update products"
  ON public.products
  FOR UPDATE
  USING (public.user_has_global_permission('Product.update'))
  WITH CHECK (public.user_has_global_permission('Product.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete products"
  ON public.products
  FOR DELETE
  USING (public.user_has_global_permission('Product.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: orders
-- Orders table
-- Permissions: SELECT=Order.list, INSERT=Order.create, UPDATE=Order.update, DELETE=Order.delete
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Users can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view orders they have access to" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can manage orders" ON public.orders;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view orders"
  ON public.orders
  FOR SELECT
  USING (public.user_has_global_permission('Order.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Order.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update orders"
  ON public.orders
  FOR UPDATE
  USING (public.user_has_global_permission('Order.update'))
  WITH CHECK (public.user_has_global_permission('Order.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete orders"
  ON public.orders
  FOR DELETE
  USING (public.user_has_global_permission('Order.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: customers
-- Customers table
-- Permissions: SELECT=Customer.list, INSERT=Customer.create, UPDATE=Customer.update, DELETE=Customer.delete
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Users can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view customers they have access to" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can manage customers" ON public.customers;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view customers"
  ON public.customers
  FOR SELECT
  USING (public.user_has_global_permission('Customer.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert customers"
  ON public.customers
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Customer.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update customers"
  ON public.customers
  FOR UPDATE
  USING (public.user_has_global_permission('Customer.update'))
  WITH CHECK (public.user_has_global_permission('Customer.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete customers"
  ON public.customers
  FOR DELETE
  USING (public.user_has_global_permission('Customer.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: discounts
-- Discounts table
-- Permissions: SELECT=Discount.list, INSERT=Discount.create, UPDATE=Discount.update, DELETE=Discount.delete
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view discounts" ON public.discounts;
DROP POLICY IF EXISTS "Users can insert discounts" ON public.discounts;
DROP POLICY IF EXISTS "Users can update discounts" ON public.discounts;
DROP POLICY IF EXISTS "Users can delete discounts" ON public.discounts;
DROP POLICY IF EXISTS "Users can view discounts they have access to" ON public.discounts;
DROP POLICY IF EXISTS "Authenticated users can manage discounts" ON public.discounts;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view discounts"
  ON public.discounts
  FOR SELECT
  USING (public.user_has_global_permission('Discount.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert discounts"
  ON public.discounts
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Discount.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update discounts"
  ON public.discounts
  FOR UPDATE
  USING (public.user_has_global_permission('Discount.update'))
  WITH CHECK (public.user_has_global_permission('Discount.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete discounts"
  ON public.discounts
  FOR DELETE
  USING (public.user_has_global_permission('Discount.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discounts TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: suppliers
-- Suppliers table
-- Permissions: SELECT=Supplier.list, INSERT=Supplier.create, UPDATE=Supplier.update, DELETE=Supplier.delete
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can view suppliers they have access to" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON public.suppliers;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view suppliers"
  ON public.suppliers
  FOR SELECT
  USING (public.user_has_global_permission('Supplier.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert suppliers"
  ON public.suppliers
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Supplier.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update suppliers"
  ON public.suppliers
  FOR UPDATE
  USING (public.user_has_global_permission('Supplier.update'))
  WITH CHECK (public.user_has_global_permission('Supplier.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete suppliers"
  ON public.suppliers
  FOR DELETE
  USING (public.user_has_global_permission('Supplier.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: supplier_versions
-- Supplier Versions (History)
-- Permissions: SELECT=Supplier.read, INSERT=Supplier.create, UPDATE=Supplier.update, DELETE=
ALTER TABLE public.supplier_versions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view supplier_versions" ON public.supplier_versions;
DROP POLICY IF EXISTS "Users can insert supplier_versions" ON public.supplier_versions;
DROP POLICY IF EXISTS "Users can update supplier_versions" ON public.supplier_versions;
DROP POLICY IF EXISTS "Users can delete supplier_versions" ON public.supplier_versions;
DROP POLICY IF EXISTS "Users can view supplier_versions they have access to" ON public.supplier_versions;
DROP POLICY IF EXISTS "Authenticated users can manage supplier_versions" ON public.supplier_versions;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view supplier_versions"
  ON public.supplier_versions
  FOR SELECT
  USING (public.user_has_global_permission('Supplier.read'));

-- Create INSERT policy
CREATE POLICY "Users can insert supplier_versions"
  ON public.supplier_versions
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Supplier.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update supplier_versions"
  ON public.supplier_versions
  FOR UPDATE
  USING (public.user_has_global_permission('Supplier.update'))
  WITH CHECK (public.user_has_global_permission('Supplier.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete supplier_versions"
  ON public.supplier_versions
  FOR DELETE
  USING (public.user_has_global_permission(''));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_versions TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: import_orders
-- Import Orders table
-- Permissions: SELECT=Inventory.list, INSERT=Inventory.create, UPDATE=Inventory.update, DELETE=Inventory.delete
ALTER TABLE public.import_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view import_orders" ON public.import_orders;
DROP POLICY IF EXISTS "Users can insert import_orders" ON public.import_orders;
DROP POLICY IF EXISTS "Users can update import_orders" ON public.import_orders;
DROP POLICY IF EXISTS "Users can delete import_orders" ON public.import_orders;
DROP POLICY IF EXISTS "Users can view import_orders they have access to" ON public.import_orders;
DROP POLICY IF EXISTS "Authenticated users can manage import_orders" ON public.import_orders;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view import_orders"
  ON public.import_orders
  FOR SELECT
  USING (public.user_has_global_permission('Inventory.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert import_orders"
  ON public.import_orders
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Inventory.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update import_orders"
  ON public.import_orders
  FOR UPDATE
  USING (public.user_has_global_permission('Inventory.update'))
  WITH CHECK (public.user_has_global_permission('Inventory.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete import_orders"
  ON public.import_orders
  FOR DELETE
  USING (public.user_has_global_permission('Inventory.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_orders TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: import_order_versions
-- Import Order Versions (History)
-- Permissions: SELECT=Inventory.read, INSERT=Inventory.update, UPDATE=Inventory.update, DELETE=
ALTER TABLE public.import_order_versions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view import_order_versions" ON public.import_order_versions;
DROP POLICY IF EXISTS "Users can insert import_order_versions" ON public.import_order_versions;
DROP POLICY IF EXISTS "Users can update import_order_versions" ON public.import_order_versions;
DROP POLICY IF EXISTS "Users can delete import_order_versions" ON public.import_order_versions;
DROP POLICY IF EXISTS "Users can view import_order_versions they have access to" ON public.import_order_versions;
DROP POLICY IF EXISTS "Authenticated users can manage import_order_versions" ON public.import_order_versions;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view import_order_versions"
  ON public.import_order_versions
  FOR SELECT
  USING (public.user_has_global_permission('Inventory.read'));

-- Create INSERT policy
CREATE POLICY "Users can insert import_order_versions"
  ON public.import_order_versions
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Inventory.update'));

-- Create UPDATE policy
CREATE POLICY "Users can update import_order_versions"
  ON public.import_order_versions
  FOR UPDATE
  USING (public.user_has_global_permission('Inventory.update'))
  WITH CHECK (public.user_has_global_permission('Inventory.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete import_order_versions"
  ON public.import_order_versions
  FOR DELETE
  USING (public.user_has_global_permission(''));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_order_versions TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: home_settings
-- Home Settings
-- Permissions: SELECT=Content.read, INSERT=Content.create, UPDATE=Content.update, DELETE=Content.delete
-- AllowAnonSelect: true (anonymous users can SELECT for embed verification)
ALTER TABLE public.home_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view home_settings" ON public.home_settings;
DROP POLICY IF EXISTS "Users can insert home_settings" ON public.home_settings;
DROP POLICY IF EXISTS "Users can update home_settings" ON public.home_settings;
DROP POLICY IF EXISTS "Users can delete home_settings" ON public.home_settings;
DROP POLICY IF EXISTS "Users can view home_settings they have access to" ON public.home_settings;
DROP POLICY IF EXISTS "Authenticated users can manage home_settings" ON public.home_settings;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view home_settings"
  ON public.home_settings
  FOR SELECT
  USING (public.user_has_global_permission('Content.read'));

-- Drop existing anon policy if exists
DROP POLICY IF EXISTS "Anon can view home_settings" ON public.home_settings;

-- Create SELECT policy for anonymous users (for embed verification)
CREATE POLICY "Anon can view home_settings"
  ON public.home_settings
  FOR SELECT
  TO anon
  USING (true);

-- Create INSERT policy
CREATE POLICY "Users can insert home_settings"
  ON public.home_settings
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Content.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update home_settings"
  ON public.home_settings
  FOR UPDATE
  USING (public.user_has_global_permission('Content.update'))
  WITH CHECK (public.user_has_global_permission('Content.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete home_settings"
  ON public.home_settings
  FOR DELETE
  USING (public.user_has_global_permission('Content.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_settings TO authenticated;
GRANT SELECT ON public.home_settings TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: import_cost_settings
-- Import Cost Settings
-- Permissions: SELECT=Settings.read, INSERT=Settings.create, UPDATE=Settings.update, DELETE=Settings.delete
ALTER TABLE public.import_cost_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view import_cost_settings" ON public.import_cost_settings;
DROP POLICY IF EXISTS "Users can insert import_cost_settings" ON public.import_cost_settings;
DROP POLICY IF EXISTS "Users can update import_cost_settings" ON public.import_cost_settings;
DROP POLICY IF EXISTS "Users can delete import_cost_settings" ON public.import_cost_settings;
DROP POLICY IF EXISTS "Users can view import_cost_settings they have access to" ON public.import_cost_settings;
DROP POLICY IF EXISTS "Authenticated users can manage import_cost_settings" ON public.import_cost_settings;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view import_cost_settings"
  ON public.import_cost_settings
  FOR SELECT
  USING (public.user_has_global_permission('Settings.read'));

-- Create INSERT policy
CREATE POLICY "Users can insert import_cost_settings"
  ON public.import_cost_settings
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Settings.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update import_cost_settings"
  ON public.import_cost_settings
  FOR UPDATE
  USING (public.user_has_global_permission('Settings.update'))
  WITH CHECK (public.user_has_global_permission('Settings.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete import_cost_settings"
  ON public.import_cost_settings
  FOR DELETE
  USING (public.user_has_global_permission('Settings.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_cost_settings TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: calculation_templates
-- Calculation Price Templates
-- Permissions: SELECT=Settings.list, INSERT=Settings.create, UPDATE=Settings.update, DELETE=Settings.delete
ALTER TABLE public.calculation_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view calculation_templates" ON public.calculation_templates;
DROP POLICY IF EXISTS "Users can insert calculation_templates" ON public.calculation_templates;
DROP POLICY IF EXISTS "Users can update calculation_templates" ON public.calculation_templates;
DROP POLICY IF EXISTS "Users can delete calculation_templates" ON public.calculation_templates;
DROP POLICY IF EXISTS "Users can view calculation_templates they have access to" ON public.calculation_templates;
DROP POLICY IF EXISTS "Authenticated users can manage calculation_templates" ON public.calculation_templates;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view calculation_templates"
  ON public.calculation_templates
  FOR SELECT
  USING (public.user_has_global_permission('Settings.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert calculation_templates"
  ON public.calculation_templates
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Settings.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update calculation_templates"
  ON public.calculation_templates
  FOR UPDATE
  USING (public.user_has_global_permission('Settings.update'))
  WITH CHECK (public.user_has_global_permission('Settings.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete calculation_templates"
  ON public.calculation_templates
  FOR DELETE
  USING (public.user_has_global_permission('Settings.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calculation_templates TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: calculation_template_items
-- Calculation Price Template Items
-- Permissions: SELECT=Settings.list, INSERT=Settings.create, UPDATE=Settings.update, DELETE=Settings.delete
ALTER TABLE public.calculation_template_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view calculation_template_items" ON public.calculation_template_items;
DROP POLICY IF EXISTS "Users can insert calculation_template_items" ON public.calculation_template_items;
DROP POLICY IF EXISTS "Users can update calculation_template_items" ON public.calculation_template_items;
DROP POLICY IF EXISTS "Users can delete calculation_template_items" ON public.calculation_template_items;
DROP POLICY IF EXISTS "Users can view calculation_template_items they have access to" ON public.calculation_template_items;
DROP POLICY IF EXISTS "Authenticated users can manage calculation_template_items" ON public.calculation_template_items;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view calculation_template_items"
  ON public.calculation_template_items
  FOR SELECT
  USING (public.user_has_global_permission('Settings.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert calculation_template_items"
  ON public.calculation_template_items
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Settings.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update calculation_template_items"
  ON public.calculation_template_items
  FOR UPDATE
  USING (public.user_has_global_permission('Settings.update'))
  WITH CHECK (public.user_has_global_permission('Settings.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete calculation_template_items"
  ON public.calculation_template_items
  FOR DELETE
  USING (public.user_has_global_permission('Settings.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calculation_template_items TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: profiles
-- User Profiles
-- Permissions: SELECT=null, INSERT=User.create, UPDATE=User.update, DELETE=User.delete
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles they have access to" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can manage profiles" ON public.profiles;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view profiles"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create INSERT policy
CREATE POLICY "Users can insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create UPDATE policy
CREATE POLICY "Users can update profiles"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create DELETE policy
CREATE POLICY "Users can delete profiles"
  ON public.profiles
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: social_post_queue
-- Social Post Queue
-- Permissions: SELECT=SocialPost.list, INSERT=SocialPost.create, UPDATE=SocialPost.update, DELETE=SocialPost.delete
ALTER TABLE public.social_post_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view social_post_queue" ON public.social_post_queue;
DROP POLICY IF EXISTS "Users can insert social_post_queue" ON public.social_post_queue;
DROP POLICY IF EXISTS "Users can update social_post_queue" ON public.social_post_queue;
DROP POLICY IF EXISTS "Users can delete social_post_queue" ON public.social_post_queue;
DROP POLICY IF EXISTS "Users can view social_post_queue they have access to" ON public.social_post_queue;
DROP POLICY IF EXISTS "Authenticated users can manage social_post_queue" ON public.social_post_queue;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view social_post_queue"
  ON public.social_post_queue
  FOR SELECT
  USING (public.user_has_global_permission('SocialPost.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert social_post_queue"
  ON public.social_post_queue
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('SocialPost.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update social_post_queue"
  ON public.social_post_queue
  FOR UPDATE
  USING (public.user_has_global_permission('SocialPost.update'))
  WITH CHECK (public.user_has_global_permission('SocialPost.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete social_post_queue"
  ON public.social_post_queue
  FOR DELETE
  USING (public.user_has_global_permission('SocialPost.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_post_queue TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: social_post_logs
-- Social Post Logs
-- Permissions: SELECT=SocialPost.list, INSERT=SocialPost.create, UPDATE=SocialPost.update, DELETE=SocialPost.delete
ALTER TABLE public.social_post_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view social_post_logs" ON public.social_post_logs;
DROP POLICY IF EXISTS "Users can insert social_post_logs" ON public.social_post_logs;
DROP POLICY IF EXISTS "Users can update social_post_logs" ON public.social_post_logs;
DROP POLICY IF EXISTS "Users can delete social_post_logs" ON public.social_post_logs;
DROP POLICY IF EXISTS "Users can view social_post_logs they have access to" ON public.social_post_logs;
DROP POLICY IF EXISTS "Authenticated users can manage social_post_logs" ON public.social_post_logs;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view social_post_logs"
  ON public.social_post_logs
  FOR SELECT
  USING (public.user_has_global_permission('SocialPost.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert social_post_logs"
  ON public.social_post_logs
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('SocialPost.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update social_post_logs"
  ON public.social_post_logs
  FOR UPDATE
  USING (public.user_has_global_permission('SocialPost.update'))
  WITH CHECK (public.user_has_global_permission('SocialPost.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete social_post_logs"
  ON public.social_post_logs
  FOR DELETE
  USING (public.user_has_global_permission('SocialPost.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_post_logs TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: social_post_settings
-- Social Post Settings
-- Permissions: SELECT=SocialPost.list, INSERT=SocialPost.create, UPDATE=SocialPost.update, DELETE=SocialPost.delete
ALTER TABLE public.social_post_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view social_post_settings" ON public.social_post_settings;
DROP POLICY IF EXISTS "Users can insert social_post_settings" ON public.social_post_settings;
DROP POLICY IF EXISTS "Users can update social_post_settings" ON public.social_post_settings;
DROP POLICY IF EXISTS "Users can delete social_post_settings" ON public.social_post_settings;
DROP POLICY IF EXISTS "Users can view social_post_settings they have access to" ON public.social_post_settings;
DROP POLICY IF EXISTS "Authenticated users can manage social_post_settings" ON public.social_post_settings;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view social_post_settings"
  ON public.social_post_settings
  FOR SELECT
  USING (public.user_has_global_permission('SocialPost.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert social_post_settings"
  ON public.social_post_settings
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('SocialPost.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update social_post_settings"
  ON public.social_post_settings
  FOR UPDATE
  USING (public.user_has_global_permission('SocialPost.update'))
  WITH CHECK (public.user_has_global_permission('SocialPost.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete social_post_settings"
  ON public.social_post_settings
  FOR DELETE
  USING (public.user_has_global_permission('SocialPost.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_post_settings TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: transactions
-- Financial Transactions
-- Permissions: SELECT=Finance.list, INSERT=Finance.create, UPDATE=Finance.update, DELETE=Finance.delete
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view transactions they have access to" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated users can manage transactions" ON public.transactions;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view transactions"
  ON public.transactions
  FOR SELECT
  USING (public.user_has_global_permission('Finance.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert transactions"
  ON public.transactions
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Finance.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update transactions"
  ON public.transactions
  FOR UPDATE
  USING (public.user_has_global_permission('Finance.update'))
  WITH CHECK (public.user_has_global_permission('Finance.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete transactions"
  ON public.transactions
  FOR DELETE
  USING (public.user_has_global_permission('Finance.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: transaction_categories
-- Transaction Categories
-- Permissions: SELECT=Finance.list, INSERT=Finance.create, UPDATE=Finance.update, DELETE=Finance.delete
ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view transaction_categories" ON public.transaction_categories;
DROP POLICY IF EXISTS "Users can insert transaction_categories" ON public.transaction_categories;
DROP POLICY IF EXISTS "Users can update transaction_categories" ON public.transaction_categories;
DROP POLICY IF EXISTS "Users can delete transaction_categories" ON public.transaction_categories;
DROP POLICY IF EXISTS "Users can view transaction_categories they have access to" ON public.transaction_categories;
DROP POLICY IF EXISTS "Authenticated users can manage transaction_categories" ON public.transaction_categories;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view transaction_categories"
  ON public.transaction_categories
  FOR SELECT
  USING (public.user_has_global_permission('Finance.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert transaction_categories"
  ON public.transaction_categories
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Finance.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update transaction_categories"
  ON public.transaction_categories
  FOR UPDATE
  USING (public.user_has_global_permission('Finance.update'))
  WITH CHECK (public.user_has_global_permission('Finance.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete transaction_categories"
  ON public.transaction_categories
  FOR DELETE
  USING (public.user_has_global_permission('Finance.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_categories TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: finance_vaults
-- Finance Vaults (Balances)
-- Permissions: SELECT=Finance.list, INSERT=Finance.create, UPDATE=Finance.update, DELETE=Finance.delete
ALTER TABLE public.finance_vaults ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view finance_vaults" ON public.finance_vaults;
DROP POLICY IF EXISTS "Users can insert finance_vaults" ON public.finance_vaults;
DROP POLICY IF EXISTS "Users can update finance_vaults" ON public.finance_vaults;
DROP POLICY IF EXISTS "Users can delete finance_vaults" ON public.finance_vaults;
DROP POLICY IF EXISTS "Users can view finance_vaults they have access to" ON public.finance_vaults;
DROP POLICY IF EXISTS "Authenticated users can manage finance_vaults" ON public.finance_vaults;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view finance_vaults"
  ON public.finance_vaults
  FOR SELECT
  USING (public.user_has_global_permission('Finance.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert finance_vaults"
  ON public.finance_vaults
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Finance.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update finance_vaults"
  ON public.finance_vaults
  FOR UPDATE
  USING (public.user_has_global_permission('Finance.update'))
  WITH CHECK (public.user_has_global_permission('Finance.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete finance_vaults"
  ON public.finance_vaults
  FOR DELETE
  USING (public.user_has_global_permission('Finance.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_vaults TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: finance_ledger
-- Finance Ledger (Immutable transaction log)
-- Permissions: SELECT=Finance.list, INSERT=Finance.create, UPDATE=, DELETE=
ALTER TABLE public.finance_ledger ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view finance_ledger" ON public.finance_ledger;
DROP POLICY IF EXISTS "Users can insert finance_ledger" ON public.finance_ledger;
DROP POLICY IF EXISTS "Users can update finance_ledger" ON public.finance_ledger;
DROP POLICY IF EXISTS "Users can delete finance_ledger" ON public.finance_ledger;
DROP POLICY IF EXISTS "Users can view finance_ledger they have access to" ON public.finance_ledger;
DROP POLICY IF EXISTS "Authenticated users can manage finance_ledger" ON public.finance_ledger;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view finance_ledger"
  ON public.finance_ledger
  FOR SELECT
  USING (public.user_has_global_permission('Finance.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert finance_ledger"
  ON public.finance_ledger
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Finance.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update finance_ledger"
  ON public.finance_ledger
  FOR UPDATE
  USING (public.user_has_global_permission(''))
  WITH CHECK (public.user_has_global_permission(''));

-- Create DELETE policy
CREATE POLICY "Users can delete finance_ledger"
  ON public.finance_ledger
  FOR DELETE
  USING (public.user_has_global_permission(''));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_ledger TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: shop_assets
-- Shop Assets (Fixed Assets)
-- Permissions: SELECT=Finance.list, INSERT=Finance.create, UPDATE=Finance.update, DELETE=Finance.delete
ALTER TABLE public.shop_assets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view shop_assets" ON public.shop_assets;
DROP POLICY IF EXISTS "Users can insert shop_assets" ON public.shop_assets;
DROP POLICY IF EXISTS "Users can update shop_assets" ON public.shop_assets;
DROP POLICY IF EXISTS "Users can delete shop_assets" ON public.shop_assets;
DROP POLICY IF EXISTS "Users can view shop_assets they have access to" ON public.shop_assets;
DROP POLICY IF EXISTS "Authenticated users can manage shop_assets" ON public.shop_assets;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view shop_assets"
  ON public.shop_assets
  FOR SELECT
  USING (public.user_has_global_permission('Finance.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert shop_assets"
  ON public.shop_assets
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Finance.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update shop_assets"
  ON public.shop_assets
  FOR UPDATE
  USING (public.user_has_global_permission('Finance.update'))
  WITH CHECK (public.user_has_global_permission('Finance.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete shop_assets"
  ON public.shop_assets
  FOR DELETE
  USING (public.user_has_global_permission('Finance.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_assets TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: newsletter_subscribers
-- Newsletter Subscribers
-- Permissions: SELECT=Newsletter.list, INSERT=, UPDATE=Newsletter.export, DELETE=Newsletter.delete
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view newsletter_subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Users can insert newsletter_subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Users can update newsletter_subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Users can delete newsletter_subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Users can view newsletter_subscribers they have access to" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Authenticated users can manage newsletter_subscribers" ON public.newsletter_subscribers;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view newsletter_subscribers"
  ON public.newsletter_subscribers
  FOR SELECT
  USING (public.user_has_global_permission('Newsletter.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert newsletter_subscribers"
  ON public.newsletter_subscribers
  FOR INSERT
  WITH CHECK (public.user_has_global_permission(''));

-- Create UPDATE policy
CREATE POLICY "Users can update newsletter_subscribers"
  ON public.newsletter_subscribers
  FOR UPDATE
  USING (public.user_has_global_permission('Newsletter.export'))
  WITH CHECK (public.user_has_global_permission('Newsletter.export'));

-- Create DELETE policy
CREATE POLICY "Users can delete newsletter_subscribers"
  ON public.newsletter_subscribers
  FOR DELETE
  USING (public.user_has_global_permission('Newsletter.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_subscribers TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: audit_logs
-- System and Finance Audit Logs
-- Permissions: SELECT=Audit.list, INSERT=Audit.create, UPDATE=, DELETE=
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can update audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can delete audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view audit_logs they have access to" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users can manage audit_logs" ON public.audit_logs;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view audit_logs"
  ON public.audit_logs
  FOR SELECT
  USING (public.user_has_global_permission('Audit.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert audit_logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Audit.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update audit_logs"
  ON public.audit_logs
  FOR UPDATE
  USING (public.user_has_global_permission(''))
  WITH CHECK (public.user_has_global_permission(''));

-- Create DELETE policy
CREATE POLICY "Users can delete audit_logs"
  ON public.audit_logs
  FOR DELETE
  USING (public.user_has_global_permission(''));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: campaigns
-- Marketing Campaigns
-- Permissions: SELECT=Marketing.list, INSERT=Marketing.create, UPDATE=Marketing.update, DELETE=Marketing.delete
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can view campaigns they have access to" ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated users can manage campaigns" ON public.campaigns;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view campaigns"
  ON public.campaigns
  FOR SELECT
  USING (public.user_has_global_permission('Marketing.list'));

-- Create INSERT policy
CREATE POLICY "Users can insert campaigns"
  ON public.campaigns
  FOR INSERT
  WITH CHECK (public.user_has_global_permission('Marketing.create'));

-- Create UPDATE policy
CREATE POLICY "Users can update campaigns"
  ON public.campaigns
  FOR UPDATE
  USING (public.user_has_global_permission('Marketing.update'))
  WITH CHECK (public.user_has_global_permission('Marketing.update'));

-- Create DELETE policy
CREATE POLICY "Users can delete campaigns"
  ON public.campaigns
  FOR DELETE
  USING (public.user_has_global_permission('Marketing.delete'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================

-- Table: messages
-- Chat Messages
-- Permissions: SELECT=null, INSERT=null, UPDATE=null, DELETE=null
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages they have access to" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can manage messages" ON public.messages;

-- Create SELECT policy for authenticated users
CREATE POLICY "Users can view messages"
  ON public.messages
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create INSERT policy
CREATE POLICY "Users can insert messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create UPDATE policy
CREATE POLICY "Users can update messages"
  ON public.messages
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create DELETE policy
CREATE POLICY "Users can delete messages"
  ON public.messages
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================================



-- ================================================
-- SECTION 3: ROLE INFORMATION (For Reference)
-- ================================================
-- The following roles are defined in the system:
--
-- super_admin: Super Admin
--   Full access to all resources
--   Permissions: 92
--
-- leader: Leader
--   Can manage products, orders, and view reports
--   Permissions: 50
--
-- staff: Staff
--   Can view products and manage orders
--   Permissions: 17
--
-- management: Management
--   Full access to business dashboard
--   Permissions: 62
--
-- default: Default User
--   Basic access to the system
--   Permissions: 4
--
