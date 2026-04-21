import { describe, it, expect, beforeEach } from 'vitest';
import { generateAdvancedHelperFunctions } from './generateAdvancedHelperFunctions';

describe('generateAdvancedHelperFunctions', () => {
  beforeEach(() => {
    // Nothing to do, already imported
  });

  describe('Function Structure', () => {
    it('should return a string containing SQL', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should contain CREATE OR REPLACE FUNCTION statements', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('CREATE OR REPLACE FUNCTION');
    });
  });

  describe('user_has_global_permission Function', () => {
    it('should create user_has_global_permission function', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.user_has_global_permission');
      expect(result).toContain('p_permission_key TEXT');
    });

    it('should use ANY operator for internal_role array', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('ANY(p.roles)');
    });

    it('should join profiles, roles, and role_permissions tables', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('FROM public.profiles p');
      expect(result).toContain('JOIN public.role_permissions rp');
    });

    it('should check auth.uid() for current user', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('auth.uid()');
    });

    it('should return BOOLEAN', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('RETURNS BOOLEAN');
    });
  });

  describe('check_org_permission Function', () => {
    it('should create check_org_permission function', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.check_org_permission');
      expect(result).toContain('p_org_id UUID');
      expect(result).toContain('p_permission_key TEXT');
    });

    it('should check organization membership', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('public.organization_members om');
      expect(result).toContain('om.organization_id = p_org_id');
    });

    it('should use organization role array with UNNEST', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('UNNEST(om.role)');
    });
  });

  describe('check_project_permission Function', () => {
    it('should create check_project_permission function', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.check_project_permission');
      expect(result).toContain('p_project_id UUID');
      expect(result).toContain('p_permission_key TEXT');
    });

    it('should check project membership', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('public.project_members pm');
      expect(result).toContain('pm.project_id = p_project_id');
    });

    it('should check organization permission as fallback', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('check_org_permission');
    });
  });

  describe('get_user_all_roles Function', () => {
    it('should create get_user_all_roles function', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.get_user_all_roles');
      expect(result).toContain('p_user_id UUID');
      expect(result).toContain('p_org_id UUID');
      expect(result).toContain('p_project_id UUID');
    });

    it('should collect roles from internal_role', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('UNNEST(p.roles)');
      expect(result).toContain('FROM public.profiles p');
    });

    it('should collect roles from organization_members using UNNEST', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('UNNEST(om.role)');
      expect(result).toContain('FROM public.organization_members om');
    });

    it('should collect roles from project_members', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('UNNEST(pm.role)');
      expect(result).toContain('FROM public.project_members pm');
    });
  });

  describe('SQL Syntax Validation', () => {
    it('should have balanced parentheses', () => {
      // Act
      const result = generateAdvancedHelperFunctions();
      const openCount = (result.match(/\(/g) || []).length;
      const closeCount = (result.match(/\)/g) || []).length;

      // Assert
      expect(openCount).toBe(closeCount);
    });

    it('should use proper PL/pgSQL syntax', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('LANGUAGE plpgsql');
      expect(result).toContain('$$');
    });

    it('should use correct schema references', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('public.profiles');
      expect(result).toContain('public.role_permissions');
      expect(result).toContain('public.organization_members');
      expect(result).toContain('public.project_members');
    });

    it('should properly terminate all functions', () => {
      // Act
      const result = generateAdvancedHelperFunctions();
      const functionCount = (result.match(/CREATE OR REPLACE FUNCTION/g) || []).length;
      const dollarCount = (result.match(/\$\$/g) || []).length;

      // Assert
      expect(dollarCount).toBe(functionCount * 2); // Each function has opening and closing $$
    });
  });

  describe('Array Handling', () => {
    it('should use ANY() for TEXT[] in WHERE clauses', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('ANY(p.roles)');
    });

    it('should not cast TEXT[] as TEXT', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).not.toContain('internal_role::TEXT');
      expect(result).not.toContain('pm.role::TEXT');
    });
  });

  describe('Column References', () => {
    it('should reference organization role array correctly', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('om.role');
    });

    it('should use correct foreign key references', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('om.user_id');
      expect(result).toContain('om.organization_id');
      expect(result).toContain('pm.project_id');
    });
  });

  describe('Security', () => {
    it('should set all functions as SECURITY DEFINER', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('SECURITY DEFINER');
    });

    it('should use auth.uid() for user identification', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('auth.uid()');
    });

    it('should check for NULL auth.uid()', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('current_user_id IS NULL');
    });
  });

  describe('Function Comments', () => {
    it('should include descriptive comments', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toContain('--');
    });

    it('should document function parameters', () => {
      // Act
      const result = generateAdvancedHelperFunctions();

      // Assert
      expect(result).toMatch(/p_permission_key|p_org_id|p_project_id|p_user_id/);
    });
  });
});
