-- ================================================
-- ADVANCED RLS POLICY REMOVAL SCRIPT
-- Generated at: 2026-01-09T14:38:48.402Z
-- 
-- This script removes all RLS policies and helper functions
-- created by the advanced RLS sync script.
-- ================================================

-- ================================================
-- SECTION 1: DROP RLS POLICIES
-- ================================================

-- Table: organizations
DROP POLICY IF EXISTS "Users can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can insert organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can update organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can delete organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view organizations they have access to" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can manage organizations" ON public.organizations;
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;

-- Table: organization_members
DROP POLICY IF EXISTS "Users can view organization_members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can insert organization_members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can update organization_members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can delete organization_members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view organization_members they have access to" ON public.organization_members;
DROP POLICY IF EXISTS "Authenticated users can manage organization_members" ON public.organization_members;
ALTER TABLE public.organization_members DISABLE ROW LEVEL SECURITY;

-- Table: projects
DROP POLICY IF EXISTS "Users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects they have access to" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can manage projects" ON public.projects;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;

-- Table: project_members
DROP POLICY IF EXISTS "Users can view project_members" ON public.project_members;
DROP POLICY IF EXISTS "Users can insert project_members" ON public.project_members;
DROP POLICY IF EXISTS "Users can update project_members" ON public.project_members;
DROP POLICY IF EXISTS "Users can delete project_members" ON public.project_members;
DROP POLICY IF EXISTS "Users can view project_members they have access to" ON public.project_members;
DROP POLICY IF EXISTS "Authenticated users can manage project_members" ON public.project_members;
ALTER TABLE public.project_members DISABLE ROW LEVEL SECURITY;

-- Table: knowledge_hubs
DROP POLICY IF EXISTS "Users can view knowledge_hubs" ON public.knowledge_hubs;
DROP POLICY IF EXISTS "Users can insert knowledge_hubs" ON public.knowledge_hubs;
DROP POLICY IF EXISTS "Users can update knowledge_hubs" ON public.knowledge_hubs;
DROP POLICY IF EXISTS "Users can delete knowledge_hubs" ON public.knowledge_hubs;
DROP POLICY IF EXISTS "Users can view knowledge_hubs they have access to" ON public.knowledge_hubs;
DROP POLICY IF EXISTS "Authenticated users can manage knowledge_hubs" ON public.knowledge_hubs;
ALTER TABLE public.knowledge_hubs DISABLE ROW LEVEL SECURITY;

-- Table: knowledge_hub_versions
DROP POLICY IF EXISTS "Users can view knowledge_hub_versions" ON public.knowledge_hub_versions;
DROP POLICY IF EXISTS "Users can insert knowledge_hub_versions" ON public.knowledge_hub_versions;
DROP POLICY IF EXISTS "Users can update knowledge_hub_versions" ON public.knowledge_hub_versions;
DROP POLICY IF EXISTS "Users can delete knowledge_hub_versions" ON public.knowledge_hub_versions;
DROP POLICY IF EXISTS "Users can view knowledge_hub_versions they have access to" ON public.knowledge_hub_versions;
DROP POLICY IF EXISTS "Authenticated users can manage knowledge_hub_versions" ON public.knowledge_hub_versions;
ALTER TABLE public.knowledge_hub_versions DISABLE ROW LEVEL SECURITY;

-- Table: data_sources
DROP POLICY IF EXISTS "Users can view data_sources" ON public.data_sources;
DROP POLICY IF EXISTS "Users can insert data_sources" ON public.data_sources;
DROP POLICY IF EXISTS "Users can update data_sources" ON public.data_sources;
DROP POLICY IF EXISTS "Users can delete data_sources" ON public.data_sources;
DROP POLICY IF EXISTS "Users can view data_sources they have access to" ON public.data_sources;
DROP POLICY IF EXISTS "Authenticated users can manage data_sources" ON public.data_sources;
ALTER TABLE public.data_sources DISABLE ROW LEVEL SECURITY;

-- Table: data_source_versions
DROP POLICY IF EXISTS "Users can view data_source_versions" ON public.data_source_versions;
DROP POLICY IF EXISTS "Users can insert data_source_versions" ON public.data_source_versions;
DROP POLICY IF EXISTS "Users can update data_source_versions" ON public.data_source_versions;
DROP POLICY IF EXISTS "Users can delete data_source_versions" ON public.data_source_versions;
DROP POLICY IF EXISTS "Users can view data_source_versions they have access to" ON public.data_source_versions;
DROP POLICY IF EXISTS "Authenticated users can manage data_source_versions" ON public.data_source_versions;
ALTER TABLE public.data_source_versions DISABLE ROW LEVEL SECURITY;

-- Table: knowledge_hub_data_source_links
DROP POLICY IF EXISTS "Users can view knowledge_hub_data_source_links" ON public.knowledge_hub_data_source_links;
DROP POLICY IF EXISTS "Users can insert knowledge_hub_data_source_links" ON public.knowledge_hub_data_source_links;
DROP POLICY IF EXISTS "Users can update knowledge_hub_data_source_links" ON public.knowledge_hub_data_source_links;
DROP POLICY IF EXISTS "Users can delete knowledge_hub_data_source_links" ON public.knowledge_hub_data_source_links;
DROP POLICY IF EXISTS "Users can view knowledge_hub_data_source_links they have access to" ON public.knowledge_hub_data_source_links;
DROP POLICY IF EXISTS "Authenticated users can manage knowledge_hub_data_source_links" ON public.knowledge_hub_data_source_links;
ALTER TABLE public.knowledge_hub_data_source_links DISABLE ROW LEVEL SECURITY;

-- Table: agents
DROP POLICY IF EXISTS "Users can view agents" ON public.agents;
DROP POLICY IF EXISTS "Users can insert agents" ON public.agents;
DROP POLICY IF EXISTS "Users can update agents" ON public.agents;
DROP POLICY IF EXISTS "Users can delete agents" ON public.agents;
DROP POLICY IF EXISTS "Users can view agents they have access to" ON public.agents;
DROP POLICY IF EXISTS "Authenticated users can manage agents" ON public.agents;
ALTER TABLE public.agents DISABLE ROW LEVEL SECURITY;

-- Table: agent_versions
DROP POLICY IF EXISTS "Users can view agent_versions" ON public.agent_versions;
DROP POLICY IF EXISTS "Users can insert agent_versions" ON public.agent_versions;
DROP POLICY IF EXISTS "Users can update agent_versions" ON public.agent_versions;
DROP POLICY IF EXISTS "Users can delete agent_versions" ON public.agent_versions;
DROP POLICY IF EXISTS "Users can view agent_versions they have access to" ON public.agent_versions;
DROP POLICY IF EXISTS "Authenticated users can manage agent_versions" ON public.agent_versions;
ALTER TABLE public.agent_versions DISABLE ROW LEVEL SECURITY;

-- Table: agent_access_keys
DROP POLICY IF EXISTS "Users can view agent_access_keys" ON public.agent_access_keys;
DROP POLICY IF EXISTS "Users can insert agent_access_keys" ON public.agent_access_keys;
DROP POLICY IF EXISTS "Users can update agent_access_keys" ON public.agent_access_keys;
DROP POLICY IF EXISTS "Users can delete agent_access_keys" ON public.agent_access_keys;
DROP POLICY IF EXISTS "Users can view agent_access_keys they have access to" ON public.agent_access_keys;
DROP POLICY IF EXISTS "Authenticated users can manage agent_access_keys" ON public.agent_access_keys;
DROP POLICY IF EXISTS "Anon can view agent_access_keys" ON public.agent_access_keys;
ALTER TABLE public.agent_access_keys DISABLE ROW LEVEL SECURITY;

-- Table: agent_embedding_metadata
DROP POLICY IF EXISTS "Users can view agent_embedding_metadata" ON public.agent_embedding_metadata;
DROP POLICY IF EXISTS "Users can insert agent_embedding_metadata" ON public.agent_embedding_metadata;
DROP POLICY IF EXISTS "Users can update agent_embedding_metadata" ON public.agent_embedding_metadata;
DROP POLICY IF EXISTS "Users can delete agent_embedding_metadata" ON public.agent_embedding_metadata;
DROP POLICY IF EXISTS "Users can view agent_embedding_metadata they have access to" ON public.agent_embedding_metadata;
DROP POLICY IF EXISTS "Authenticated users can manage agent_embedding_metadata" ON public.agent_embedding_metadata;
DROP POLICY IF EXISTS "Anon can view agent_embedding_metadata" ON public.agent_embedding_metadata;
ALTER TABLE public.agent_embedding_metadata DISABLE ROW LEVEL SECURITY;

-- Table: agent_hub_links
DROP POLICY IF EXISTS "Users can view agent_hub_links" ON public.agent_hub_links;
DROP POLICY IF EXISTS "Users can insert agent_hub_links" ON public.agent_hub_links;
DROP POLICY IF EXISTS "Users can update agent_hub_links" ON public.agent_hub_links;
DROP POLICY IF EXISTS "Users can delete agent_hub_links" ON public.agent_hub_links;
DROP POLICY IF EXISTS "Users can view agent_hub_links they have access to" ON public.agent_hub_links;
DROP POLICY IF EXISTS "Authenticated users can manage agent_hub_links" ON public.agent_hub_links;
ALTER TABLE public.agent_hub_links DISABLE ROW LEVEL SECURITY;

-- Table: agent_hub_data_source_links
DROP POLICY IF EXISTS "Users can view agent_hub_data_source_links" ON public.agent_hub_data_source_links;
DROP POLICY IF EXISTS "Users can insert agent_hub_data_source_links" ON public.agent_hub_data_source_links;
DROP POLICY IF EXISTS "Users can update agent_hub_data_source_links" ON public.agent_hub_data_source_links;
DROP POLICY IF EXISTS "Users can delete agent_hub_data_source_links" ON public.agent_hub_data_source_links;
DROP POLICY IF EXISTS "Users can view agent_hub_data_source_links they have access to" ON public.agent_hub_data_source_links;
DROP POLICY IF EXISTS "Authenticated users can manage agent_hub_data_source_links" ON public.agent_hub_data_source_links;
ALTER TABLE public.agent_hub_data_source_links DISABLE ROW LEVEL SECURITY;

-- Table: agent_test_suites
DROP POLICY IF EXISTS "Users can view agent_test_suites" ON public.agent_test_suites;
DROP POLICY IF EXISTS "Users can insert agent_test_suites" ON public.agent_test_suites;
DROP POLICY IF EXISTS "Users can update agent_test_suites" ON public.agent_test_suites;
DROP POLICY IF EXISTS "Users can delete agent_test_suites" ON public.agent_test_suites;
DROP POLICY IF EXISTS "Users can view agent_test_suites they have access to" ON public.agent_test_suites;
DROP POLICY IF EXISTS "Authenticated users can manage agent_test_suites" ON public.agent_test_suites;
ALTER TABLE public.agent_test_suites DISABLE ROW LEVEL SECURITY;

-- Table: agent_test_cases
DROP POLICY IF EXISTS "Users can view agent_test_cases" ON public.agent_test_cases;
DROP POLICY IF EXISTS "Users can insert agent_test_cases" ON public.agent_test_cases;
DROP POLICY IF EXISTS "Users can update agent_test_cases" ON public.agent_test_cases;
DROP POLICY IF EXISTS "Users can delete agent_test_cases" ON public.agent_test_cases;
DROP POLICY IF EXISTS "Users can view agent_test_cases they have access to" ON public.agent_test_cases;
DROP POLICY IF EXISTS "Authenticated users can manage agent_test_cases" ON public.agent_test_cases;
ALTER TABLE public.agent_test_cases DISABLE ROW LEVEL SECURITY;

-- Table: agent_test_runs
DROP POLICY IF EXISTS "Users can view agent_test_runs" ON public.agent_test_runs;
DROP POLICY IF EXISTS "Users can insert agent_test_runs" ON public.agent_test_runs;
DROP POLICY IF EXISTS "Users can update agent_test_runs" ON public.agent_test_runs;
DROP POLICY IF EXISTS "Users can delete agent_test_runs" ON public.agent_test_runs;
DROP POLICY IF EXISTS "Users can view agent_test_runs they have access to" ON public.agent_test_runs;
DROP POLICY IF EXISTS "Authenticated users can manage agent_test_runs" ON public.agent_test_runs;
ALTER TABLE public.agent_test_runs DISABLE ROW LEVEL SECURITY;

-- Table: agent_test_case_results
DROP POLICY IF EXISTS "Users can view agent_test_case_results" ON public.agent_test_case_results;
DROP POLICY IF EXISTS "Users can insert agent_test_case_results" ON public.agent_test_case_results;
DROP POLICY IF EXISTS "Users can update agent_test_case_results" ON public.agent_test_case_results;
DROP POLICY IF EXISTS "Users can delete agent_test_case_results" ON public.agent_test_case_results;
DROP POLICY IF EXISTS "Users can view agent_test_case_results they have access to" ON public.agent_test_case_results;
DROP POLICY IF EXISTS "Authenticated users can manage agent_test_case_results" ON public.agent_test_case_results;
ALTER TABLE public.agent_test_case_results DISABLE ROW LEVEL SECURITY;

-- Table: tools
DROP POLICY IF EXISTS "Users can view tools" ON public.tools;
DROP POLICY IF EXISTS "Users can insert tools" ON public.tools;
DROP POLICY IF EXISTS "Users can update tools" ON public.tools;
DROP POLICY IF EXISTS "Users can delete tools" ON public.tools;
DROP POLICY IF EXISTS "Users can view tools they have access to" ON public.tools;
DROP POLICY IF EXISTS "Authenticated users can manage tools" ON public.tools;
ALTER TABLE public.tools DISABLE ROW LEVEL SECURITY;

-- Table: tool_secrets
DROP POLICY IF EXISTS "Users can view tool_secrets" ON public.tool_secrets;
DROP POLICY IF EXISTS "Users can insert tool_secrets" ON public.tool_secrets;
DROP POLICY IF EXISTS "Users can update tool_secrets" ON public.tool_secrets;
DROP POLICY IF EXISTS "Users can delete tool_secrets" ON public.tool_secrets;
DROP POLICY IF EXISTS "Users can view tool_secrets they have access to" ON public.tool_secrets;
DROP POLICY IF EXISTS "Authenticated users can manage tool_secrets" ON public.tool_secrets;
ALTER TABLE public.tool_secrets DISABLE ROW LEVEL SECURITY;

-- Table: tool_invocations
DROP POLICY IF EXISTS "Users can view tool_invocations" ON public.tool_invocations;
DROP POLICY IF EXISTS "Users can insert tool_invocations" ON public.tool_invocations;
DROP POLICY IF EXISTS "Users can update tool_invocations" ON public.tool_invocations;
DROP POLICY IF EXISTS "Users can delete tool_invocations" ON public.tool_invocations;
DROP POLICY IF EXISTS "Users can view tool_invocations they have access to" ON public.tool_invocations;
DROP POLICY IF EXISTS "Authenticated users can manage tool_invocations" ON public.tool_invocations;
ALTER TABLE public.tool_invocations DISABLE ROW LEVEL SECURITY;

-- Table: document_chunks
DROP POLICY IF EXISTS "Users can view document_chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can insert document_chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can update document_chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can delete document_chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can view document_chunks they have access to" ON public.document_chunks;
DROP POLICY IF EXISTS "Authenticated users can manage document_chunks" ON public.document_chunks;
ALTER TABLE public.document_chunks DISABLE ROW LEVEL SECURITY;

-- Table: conversations
DROP POLICY IF EXISTS "Users can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view conversations they have access to" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can manage conversations" ON public.conversations;
ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;

-- Table: conversation_messages
DROP POLICY IF EXISTS "Users can view conversation_messages" ON public.conversation_messages;
DROP POLICY IF EXISTS "Users can insert conversation_messages" ON public.conversation_messages;
DROP POLICY IF EXISTS "Users can update conversation_messages" ON public.conversation_messages;
DROP POLICY IF EXISTS "Users can delete conversation_messages" ON public.conversation_messages;
DROP POLICY IF EXISTS "Users can view conversation_messages they have access to" ON public.conversation_messages;
DROP POLICY IF EXISTS "Authenticated users can manage conversation_messages" ON public.conversation_messages;
ALTER TABLE public.conversation_messages DISABLE ROW LEVEL SECURITY;

-- Table: invitations
DROP POLICY IF EXISTS "Users can view invitations" ON public.invitations;
DROP POLICY IF EXISTS "Users can insert invitations" ON public.invitations;
DROP POLICY IF EXISTS "Users can update invitations" ON public.invitations;
DROP POLICY IF EXISTS "Users can delete invitations" ON public.invitations;
DROP POLICY IF EXISTS "Users can view invitations they have access to" ON public.invitations;
DROP POLICY IF EXISTS "Authenticated users can manage invitations" ON public.invitations;
ALTER TABLE public.invitations DISABLE ROW LEVEL SECURITY;

-- Table: models
DROP POLICY IF EXISTS "Users can view models" ON public.models;
DROP POLICY IF EXISTS "Users can insert models" ON public.models;
DROP POLICY IF EXISTS "Users can update models" ON public.models;
DROP POLICY IF EXISTS "Users can delete models" ON public.models;
DROP POLICY IF EXISTS "Users can view models they have access to" ON public.models;
DROP POLICY IF EXISTS "Authenticated users can manage models" ON public.models;
ALTER TABLE public.models DISABLE ROW LEVEL SECURITY;

-- Table: profiles
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles they have access to" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can manage profiles" ON public.profiles;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Table: profiles_public
DROP POLICY IF EXISTS "Users can view profiles_public" ON public.profiles_public;
DROP POLICY IF EXISTS "Users can insert profiles_public" ON public.profiles_public;
DROP POLICY IF EXISTS "Users can update profiles_public" ON public.profiles_public;
DROP POLICY IF EXISTS "Users can delete profiles_public" ON public.profiles_public;
DROP POLICY IF EXISTS "Users can view profiles_public they have access to" ON public.profiles_public;
DROP POLICY IF EXISTS "Authenticated users can manage profiles_public" ON public.profiles_public;
ALTER TABLE public.profiles_public DISABLE ROW LEVEL SECURITY;

-- Table: permissions
DROP POLICY IF EXISTS "Users can view permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can insert permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can update permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can delete permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can view permissions they have access to" ON public.permissions;
DROP POLICY IF EXISTS "Authenticated users can manage permissions" ON public.permissions;
ALTER TABLE public.permissions DISABLE ROW LEVEL SECURITY;

-- Table: roles
DROP POLICY IF EXISTS "Users can view roles" ON public.roles;
DROP POLICY IF EXISTS "Users can insert roles" ON public.roles;
DROP POLICY IF EXISTS "Users can update roles" ON public.roles;
DROP POLICY IF EXISTS "Users can delete roles" ON public.roles;
DROP POLICY IF EXISTS "Users can view roles they have access to" ON public.roles;
DROP POLICY IF EXISTS "Authenticated users can manage roles" ON public.roles;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;

-- Table: role_permissions
DROP POLICY IF EXISTS "Users can view role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Users can insert role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Users can update role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Users can delete role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Users can view role_permissions they have access to" ON public.role_permissions;
DROP POLICY IF EXISTS "Authenticated users can manage role_permissions" ON public.role_permissions;
ALTER TABLE public.role_permissions DISABLE ROW LEVEL SECURITY;

-- Table: public_conversations
DROP POLICY IF EXISTS "Users can view public_conversations" ON public.public_conversations;
DROP POLICY IF EXISTS "Users can insert public_conversations" ON public.public_conversations;
DROP POLICY IF EXISTS "Users can update public_conversations" ON public.public_conversations;
DROP POLICY IF EXISTS "Users can delete public_conversations" ON public.public_conversations;
DROP POLICY IF EXISTS "Users can view public_conversations they have access to" ON public.public_conversations;
DROP POLICY IF EXISTS "Authenticated users can manage public_conversations" ON public.public_conversations;
ALTER TABLE public.public_conversations DISABLE ROW LEVEL SECURITY;

-- Table: public_conversation_messages
DROP POLICY IF EXISTS "Users can view public_conversation_messages" ON public.public_conversation_messages;
DROP POLICY IF EXISTS "Users can insert public_conversation_messages" ON public.public_conversation_messages;
DROP POLICY IF EXISTS "Users can update public_conversation_messages" ON public.public_conversation_messages;
DROP POLICY IF EXISTS "Users can delete public_conversation_messages" ON public.public_conversation_messages;
DROP POLICY IF EXISTS "Users can view public_conversation_messages they have access to" ON public.public_conversation_messages;
DROP POLICY IF EXISTS "Authenticated users can manage public_conversation_messages" ON public.public_conversation_messages;
ALTER TABLE public.public_conversation_messages DISABLE ROW LEVEL SECURITY;

-- Table: agent_tools
DROP POLICY IF EXISTS "Users can view agent_tools" ON public.agent_tools;
DROP POLICY IF EXISTS "Users can insert agent_tools" ON public.agent_tools;
DROP POLICY IF EXISTS "Users can update agent_tools" ON public.agent_tools;
DROP POLICY IF EXISTS "Users can delete agent_tools" ON public.agent_tools;
DROP POLICY IF EXISTS "Users can view agent_tools they have access to" ON public.agent_tools;
DROP POLICY IF EXISTS "Authenticated users can manage agent_tools" ON public.agent_tools;
ALTER TABLE public.agent_tools DISABLE ROW LEVEL SECURITY;

-- Table: conversation_summaries
DROP POLICY IF EXISTS "Users can view conversation_summaries" ON public.conversation_summaries;
DROP POLICY IF EXISTS "Users can insert conversation_summaries" ON public.conversation_summaries;
DROP POLICY IF EXISTS "Users can update conversation_summaries" ON public.conversation_summaries;
DROP POLICY IF EXISTS "Users can delete conversation_summaries" ON public.conversation_summaries;
DROP POLICY IF EXISTS "Users can view conversation_summaries they have access to" ON public.conversation_summaries;
DROP POLICY IF EXISTS "Authenticated users can manage conversation_summaries" ON public.conversation_summaries;
ALTER TABLE public.conversation_summaries DISABLE ROW LEVEL SECURITY;



-- ================================================
-- SECTION 2: DROP HELPER FUNCTIONS
-- ================================================

-- Drop permission checking functions
DROP FUNCTION IF EXISTS public.user_has_global_permission(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.check_org_permission(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.check_project_permission(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_all_roles(UUID, UUID, UUID) CASCADE;

-- ================================================
-- REMOVAL COMPLETE
-- ================================================
