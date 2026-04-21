/**
 * Drop Statements Generator
 *
 * Generates DROP FUNCTION statements to clean up existing functions before recreation
 */

/**
 * List of all helper functions with their signatures
 * Used to generate DROP statements
 */
const HELPER_FUNCTION_SIGNATURES = [
  'public.user_has_permission(UUID, UUID, TEXT)',
  'public.user_has_permission(UUID, UUID, UUID, TEXT)',
  'public.get_user_all_roles(UUID, UUID, UUID)',
  'public.user_has_org_access(UUID)',
  'public.user_has_project_access(UUID)',
  'public.user_has_project_resource_access(UUID, TEXT)',
  'public.user_has_agent_access(UUID)',
  'public.user_has_conversation_access(UUID)',
  'public.user_has_tool_access(UUID)',
  'public.user_has_test_suite_access(UUID)',
  'public.user_has_knowledge_hub_access(UUID)',
  'public.user_has_data_source_access(UUID)',
  'public.user_has_knowledge_hub_version_access(UUID)',
  'public.user_has_agent_hub_link_access(UUID)',
  'public.user_has_agent_version_resource_access(UUID)',
  'public.user_has_global_permission(TEXT)',
  'public.check_org_permission(UUID, TEXT)',
  'public.check_project_permission(UUID, TEXT)',
  'public.is_super_admin()',
  'public.is_organization_owner(UUID)',
];

/**
 * Generate DROP statements for all helper functions
 * @returns {string} SQL DROP statements
 */
function generateDropStatements() {
  const dropStatements = HELPER_FUNCTION_SIGNATURES.map((fn) => `DROP FUNCTION IF EXISTS ${fn} CASCADE;`).join('\n');

  return `-- Drop existing helper functions first to avoid conflicts
${dropStatements}`;
}

module.exports = {
  generateDropStatements,
  HELPER_FUNCTION_SIGNATURES,
};
