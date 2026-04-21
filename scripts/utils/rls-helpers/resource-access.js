/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Resource-Specific Access Functions
 *
 * SQL generators for checking access to specific resources:
 * - Agents, Conversations, Tools
 * - Test Suites, Knowledge Hubs, Data Sources
 * - Knowledge Hub Versions, Agent Hub Links, Agent Versions
 */

const { createFunctionHeader, createFunctionFooter } = require('./sql-utils');

// =============================================================================
// GENERIC RESOURCE ACCESS GENERATOR
// =============================================================================

/**
 * Generate a simple resource access function that checks via another table
 *
 * @param {Object} config - Configuration for the resource access function
 * @param {string} config.functionName - Name of the function
 * @param {string} config.paramName - Name of the parameter
 * @param {string} config.sourceTable - Table to lookup the parent ID from
 * @param {string} config.sourceColumn - Column in source table containing the parent ID
 * @param {string} config.parentAccessFunction - Function to call for parent access check
 * @param {string} config.description - Description for the SQL comment
 * @returns {string} SQL function definition
 */
function generateSimpleResourceAccess({
  functionName,
  paramName,
  sourceTable,
  sourceColumn,
  parentAccessFunction,
  description,
}) {
  return `
-- ================================================
-- HELPER FUNCTION: ${description}
-- ================================================
${createFunctionHeader(functionName, [`${paramName} UUID`], 'BOOLEAN')}
DECLARE
  parent_id UUID;
BEGIN
  -- Get the parent ID from the source table
  SELECT ${sourceColumn} INTO parent_id
  FROM public.${sourceTable}
  WHERE id = ${paramName};
  
  -- Check if user has access to the parent
  RETURN public.${parentAccessFunction}(parent_id);
END;
${createFunctionFooter()}`;
}

// =============================================================================
// AGENT ACCESS
// =============================================================================

/**
 * Generate user_has_agent_access function
 *
 * @returns {string} SQL function definition
 */
function generateUserHasAgentAccess() {
  return `
-- ================================================
-- HELPER FUNCTION: Check agent access
-- ================================================
${createFunctionHeader('user_has_agent_access', ['agent_id UUID'], 'BOOLEAN')}
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
${createFunctionFooter()}`;
}

// =============================================================================
// CONVERSATION ACCESS
// =============================================================================

/**
 * Generate user_has_conversation_access function
 *
 * Supports org-wide access:
 * - All members of the agent's organization can view conversations (SELECT)
 * - Creator OR members with agent.update can modify (UPDATE)
 * - Creator OR members with agent.delete can remove (DELETE)
 *
 * @returns {string} SQL function definition
 */
function generateUserHasConversationAccess() {
  return `
-- ================================================
-- HELPER FUNCTION: Check conversation access (org-scoped)
-- ================================================
${createFunctionHeader('user_has_conversation_access', ['conversation_id UUID'], 'BOOLEAN')}
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
${createFunctionFooter()}`;
}

// =============================================================================
// TOOL ACCESS
// =============================================================================

/**
 * Generate user_has_tool_access function
 *
 * @returns {string} SQL function definition
 */
function generateUserHasToolAccess() {
  return `
-- ================================================
-- HELPER FUNCTION: Check tool access
-- ================================================
${createFunctionHeader('user_has_tool_access', ['tool_id UUID'], 'BOOLEAN')}
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
${createFunctionFooter()}`;
}

// =============================================================================
// TEST SUITE ACCESS
// =============================================================================

/**
 * Generate user_has_test_suite_access function
 *
 * @returns {string} SQL function definition
 */
function generateUserHasTestSuiteAccess() {
  return generateSimpleResourceAccess({
    functionName: 'user_has_test_suite_access',
    paramName: 'test_suite_id',
    sourceTable: 'agent_test_suites',
    sourceColumn: 'agent_id',
    parentAccessFunction: 'user_has_agent_access',
    description: 'Check test suite access',
  });
}

// =============================================================================
// KNOWLEDGE HUB ACCESS
// =============================================================================

/**
 * Generate user_has_knowledge_hub_access function
 *
 * @returns {string} SQL function definition
 */
function generateUserHasKnowledgeHubAccess() {
  return `
-- ================================================
-- HELPER FUNCTION: Check knowledge hub access via hub
-- ================================================
${createFunctionHeader('user_has_knowledge_hub_access', ['hub_id UUID'], 'BOOLEAN')}
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
${createFunctionFooter()}`;
}

// =============================================================================
// DATA SOURCE ACCESS
// =============================================================================

/**
 * Generate user_has_data_source_access function
 *
 * @returns {string} SQL function definition
 */
function generateUserHasDataSourceAccess() {
  return `
-- ================================================
-- HELPER FUNCTION: Check data source access via source
-- ================================================
${createFunctionHeader('user_has_data_source_access', ['source_id UUID'], 'BOOLEAN')}
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
${createFunctionFooter()}`;
}

// =============================================================================
// KNOWLEDGE HUB VERSION ACCESS
// =============================================================================

/**
 * Generate user_has_knowledge_hub_version_access function
 *
 * @returns {string} SQL function definition
 */
function generateUserHasKnowledgeHubVersionAccess() {
  return generateSimpleResourceAccess({
    functionName: 'user_has_knowledge_hub_version_access',
    paramName: 'version_id',
    sourceTable: 'knowledge_hub_versions',
    sourceColumn: 'knowledge_hub_id',
    parentAccessFunction: 'user_has_knowledge_hub_access',
    description: 'Check knowledge hub version access',
  });
}

// =============================================================================
// AGENT HUB LINK ACCESS
// =============================================================================

/**
 * Generate user_has_agent_hub_link_access function
 *
 * @returns {string} SQL function definition
 */
function generateUserHasAgentHubLinkAccess() {
  return `
-- ================================================
-- HELPER FUNCTION: Check agent hub link access
-- ================================================
${createFunctionHeader('user_has_agent_hub_link_access', ['link_id UUID'], 'BOOLEAN')}
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
${createFunctionFooter()}`;
}

// =============================================================================
// AGENT VERSION RESOURCE ACCESS
// =============================================================================

/**
 * Generate user_has_agent_version_resource_access function
 *
 * @returns {string} SQL function definition
 */
function generateUserHasAgentVersionResourceAccess() {
  return generateSimpleResourceAccess({
    functionName: 'user_has_agent_version_resource_access',
    paramName: 'version_id',
    sourceTable: 'agent_versions',
    sourceColumn: 'agent_id',
    parentAccessFunction: 'user_has_agent_access',
    description: 'Check agent version resource access',
  });
}

module.exports = {
  generateSimpleResourceAccess,
  generateUserHasAgentAccess,
  generateUserHasConversationAccess,
  generateUserHasToolAccess,
  generateUserHasTestSuiteAccess,
  generateUserHasKnowledgeHubAccess,
  generateUserHasDataSourceAccess,
  generateUserHasKnowledgeHubVersionAccess,
  generateUserHasAgentHubLinkAccess,
  generateUserHasAgentVersionResourceAccess,
};
