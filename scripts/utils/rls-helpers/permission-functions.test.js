import { describe, it, expect } from 'vitest';
import {
  generateUserHasGlobalPermission,
  generateGetUserAllRoles,
  generateUserHasPermissionEnhanced,
  generateUserHasPermissionLegacy,
} from './permission-functions';

describe('permission-functions', () => {
  describe('generateUserHasGlobalPermission', () => {
    it('should generate global permission check function', () => {
      const result = generateUserHasGlobalPermission();
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.user_has_global_permission');
      expect(result).toContain('is_super_admin()');
      expect(result).toContain('rp.role_code = ANY(p.roles)');
    });
  });

  describe('generateGetUserAllRoles', () => {
    it('should generate get_user_all_roles function', () => {
      const result = generateGetUserAllRoles();
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.get_user_all_roles');
      expect(result).toContain('roles');
      // organization_members.role
      expect(result).toContain('organization_members');
      // project_members.role
      expect(result).toContain('project_members');
    });
  });

  describe('generateUserHasPermissionEnhanced', () => {
    it('should generate enhanced user permission check function', () => {
      const result = generateUserHasPermissionEnhanced();
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.user_has_permission');
      expect(result).toContain('get_user_all_roles');
      expect(result).toContain('JOIN public.role_permissions rp');
    });
  });

  describe('generateUserHasPermissionLegacy', () => {
    it('should generate legacy user permission check function', () => {
      const result = generateUserHasPermissionLegacy();
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.user_has_permission');
      expect(result).toContain(
        'RETURN public.user_has_permission(user_id, org_id, NULL::UUID, permission_key)',
      );
    });
  });
});
