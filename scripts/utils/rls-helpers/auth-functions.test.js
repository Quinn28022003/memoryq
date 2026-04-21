import { describe, it, expect } from 'vitest';
import { generateIsSuperAdmin, generateIsOrganizationOwner } from './auth-functions';

describe('auth-functions', () => {
  describe('generateIsSuperAdmin', () => {
    it('should generate is_super_admin function', () => {
      const superAdminRole = 'SUPER_ADMIN';
      const result = generateIsSuperAdmin(superAdminRole);

      expect(result).toContain('CREATE OR REPLACE FUNCTION public.is_super_admin');
      expect(result).toContain('SECURITY DEFINER');
      expect(result).toContain(`'${superAdminRole}' = ANY(p.roles)`);
    });
  });

  describe('generateIsOrganizationOwner', () => {
    it('should generate is_organization_owner function', () => {
      const result = generateIsOrganizationOwner();
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.is_organization_owner');
      expect(result).toContain('p_org_id UUID');
      expect(result).toContain('is_super_admin()');
      expect(result).toContain("'organization_owner' = ANY(om.role)");
    });
  });
});
