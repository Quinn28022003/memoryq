import { describe, it, expect } from 'vitest';
import {
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
} from './resource-access';

describe('resource-access', () => {
  describe('generateSimpleResourceAccess', () => {
    it('should generate a simple access function', () => {
      const config = {
        functionName: 'test_func',
        paramName: 'p_id',
        sourceTable: 'my_table',
        sourceColumn: 'parent_id',
        parentAccessFunction: 'check_parent',
        description: 'Test Description',
      };
      const result = generateSimpleResourceAccess(config);

      expect(result).toContain('CREATE OR REPLACE FUNCTION public.test_func');
      expect(result).toContain('p_id UUID');
      expect(result).toContain('SELECT parent_id INTO parent_id');
      expect(result).toContain('FROM public.my_table');
      expect(result).toContain('RETURN public.check_parent(parent_id)');
    });
  });

  describe('generateUserHasAgentAccess', () => {
    it('should generate agent access function', () => {
      const result = generateUserHasAgentAccess();
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.user_has_agent_access');
      expect(result).toContain('FROM public.agents');
      expect(result).toContain('RETURN public.user_has_project_access(agent_project_id)');
    });
  });

  describe('generateUserHasConversationAccess', () => {
    it('should generate conversation access function', () => {
      const result = generateUserHasConversationAccess();
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.user_has_conversation_access');
      expect(result).toContain('FROM public.conversations');
      expect(result).toContain('project_org_id');
      expect(result).toContain('public.organization_members om');
    });
  });

  describe('generateUserHasToolAccess', () => {
    it('should generate tool access function', () => {
      const result = generateUserHasToolAccess();
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.user_has_tool_access');
      expect(result).toContain('FROM public.tools');
      expect(result).toContain('RETURN public.user_has_org_access(tool_org_id)');
    });
  });

  describe('generateUserHasTestSuiteAccess', () => {
    it('should generate test suite access function via agent', () => {
      const result = generateUserHasTestSuiteAccess();
      expect(result).toContain('user_has_test_suite_access');
      expect(result).toContain('agent_test_suites');
      expect(result).toContain('user_has_agent_access');
    });
  });

  describe('generateUserHasKnowledgeHubAccess', () => {
    it('should generate knowledge hub access function', () => {
      const result = generateUserHasKnowledgeHubAccess();
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.user_has_knowledge_hub_access');
      expect(result).toContain('FROM public.knowledge_hubs');
      expect(result).toContain('RETURN public.user_has_org_access(hub_org_id)');
    });
  });

  describe('generateUserHasDataSourceAccess', () => {
    it('should generate data source access function via hub', () => {
      const result = generateUserHasDataSourceAccess();
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.user_has_data_source_access');
      expect(result).toContain('FROM public.data_sources');
      expect(result).toContain('RETURN public.user_has_knowledge_hub_access(source_hub_id)');
    });
  });

  describe('generateUserHasKnowledgeHubVersionAccess', () => {
    it('should generate knowledge hub version access function', () => {
      const result = generateUserHasKnowledgeHubVersionAccess();
      expect(result).toContain('user_has_knowledge_hub_version_access');
      expect(result).toContain('knowledge_hub_versions');
      expect(result).toContain('user_has_knowledge_hub_access');
    });
  });

  describe('generateUserHasAgentHubLinkAccess', () => {
    it('should generate agent hub link access function', () => {
      const result = generateUserHasAgentHubLinkAccess();
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.user_has_agent_hub_link_access');
      expect(result).toContain('FROM public.agent_hub_links');
      expect(result).toContain('FROM public.agent_versions');
      expect(result).toContain('RETURN public.user_has_agent_access(link_agent_id)');
    });
  });

  describe('generateUserHasAgentVersionResourceAccess', () => {
    it('should generate agent version resource access function', () => {
      const result = generateUserHasAgentVersionResourceAccess();
      expect(result).toContain('user_has_agent_version_resource_access');
      expect(result).toContain('agent_versions');
      expect(result).toContain('user_has_agent_access');
    });
  });
});
