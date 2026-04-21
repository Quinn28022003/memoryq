import { describe, it, expect } from 'vitest';
import {
  generateUserHasOrgAccess,
  generateCheckOrgPermission,
  generateCheckProjectPermission,
  generateUserHasProjectAccess,
  generateUserHasProjectResourceAccess,
} from './org-project-access';

describe('org-project-access', () => {
  describe('generateUserHasOrgAccess', () => {
    it('should generate org access function', () => {
      const result = generateUserHasOrgAccess();
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.user_has_org_access');
      expect(result).toContain('FROM public.organization_members');
      expect(result).toContain('organization_id = org_id');
    });
  });

  describe('generateCheckOrgPermission', () => {
    it('should generate org permission check function', () => {
      const result = generateCheckOrgPermission();
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.check_org_permission');
      expect(result).toContain('is_super_admin()');
      expect(result).toContain('FROM public.organization_members om');
      expect(result).toContain('rp.role_key = ANY(om.role)');
    });
  });

  describe('generateCheckProjectPermission', () => {
    it('should generate project permission check function', () => {
      const result = generateCheckProjectPermission();
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.check_project_permission');
      expect(result).toContain('FROM public.projects');
      expect(result).toContain('FROM public.organization_members om');
      expect(result).toContain('FROM public.project_members pm');
    });
  });

  describe('generateUserHasProjectAccess', () => {
    it('should generate project access function', () => {
      const result = generateUserHasProjectAccess();
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.user_has_project_access');
      expect(result).toContain('FROM public.projects');
      expect(result).toContain('RETURN public.user_has_org_access(proj_org_id)');
    });
  });

  describe('generateUserHasProjectResourceAccess', () => {
    it('should generate project resource access function', () => {
      const result = generateUserHasProjectResourceAccess();
      expect(result).toContain(
        'CREATE OR REPLACE FUNCTION public.user_has_project_resource_access',
      );
      expect(result).toContain('FROM public.projects');
      expect(result).toContain(
        'RETURN public.user_has_permission(current_user_id, proj_org_id, permission_key)',
      );
    });
  });
});
