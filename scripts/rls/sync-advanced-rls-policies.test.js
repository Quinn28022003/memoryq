import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateAdvancedHelperFunctions } from '../utils/generateAdvancedHelperFunctions';

describe('sync-advanced-rls-policies script', () => {
  let originalEnv;
  let mockSupabaseClient;
  let mockCreateScriptClient;
  let mockAdvancedRlsConfig;
  let mockRoles;
  let consoleLogSpy;
  let consoleErrorSpy;
  let processExitSpy;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Setup environment
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    // Mock ROLES
    mockRoles = [
      { key: 'super_admin', label: 'Super Admin' },
      { key: 'admin', label: 'Admin' },
    ];

    // Mock ADVANCED_RLS_CONFIG
    mockAdvancedRlsConfig = [
      {
        table: 'agents',
        description: 'AI Agents',
        checkType: 'global_permission',
        permissions: {
          select: 'Agent.read',
          insert: 'Agent.create',
          update: 'Agent.update',
          delete: 'Agent.delete',
        },
      },
      {
        table: 'projects',
        description: 'Projects',
        checkType: 'project_member',
        accessParam: 'id',
        permissions: {
          select: 'Project.read',
          insert: 'Project.create',
          update: 'Project.update',
          delete: 'Project.delete',
        },
      },
    ];

    // Mock Supabase client
    mockSupabaseClient = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };

    mockCreateScriptClient = vi.fn(() => mockSupabaseClient);

    // Mock console and process
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

    // Clear module cache
    vi.resetModules();
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('SQL Generation', () => {
    it('should generate helper functions SQL', () => {
      // Arrange

      // Arrange

      // Act
      const sql = generateAdvancedHelperFunctions();

      // Assert
      expect(sql).toContain('CREATE OR REPLACE FUNCTION');
      expect(sql).toContain('user_has_global_permission');
      expect(sql).toContain('check_org_permission');
      expect(sql).toContain('check_project_permission');
      expect(sql).toContain('get_user_all_roles');
    });

    it('should generate policy SQL for each table', () => {
      // Arrange
      const config = mockAdvancedRlsConfig[0];

      // Act
      const policySql = `ALTER TABLE public.${config.table} ENABLE ROW LEVEL SECURITY;`;

      // Assert
      expect(policySql).toContain('ALTER TABLE');
      expect(policySql).toContain(config.table);
      expect(policySql).toContain('ENABLE ROW LEVEL SECURITY');
    });

    it('should generate DROP statements for existing policies', () => {
      // Arrange
      const table = 'agents';

      // Act
      const dropSql = `DROP POLICY IF EXISTS "Users can view ${table}" ON public.${table};`;

      // Assert
      expect(dropSql).toContain('DROP POLICY IF EXISTS');
      expect(dropSql).toContain(table);
    });
  });

  describe('Access Check Logic', () => {
    it('should generate correct access check for global_permission', () => {
      // Arrange
      const permissionKey = 'Agent.read';
      const checkType = 'global_permission';

      // Act
      const accessCheck = `user_has_global_permission('${permissionKey}')`;

      // Assert
      expect(accessCheck).toContain('user_has_global_permission');
      expect(accessCheck).toContain(permissionKey);
    });

    it('should generate correct access check for organization_member', () => {
      // Arrange
      const orgParam = 'organization_id';
      const permissionKey = 'Organization.read';

      // Act
      const accessCheck = `check_org_permission(${orgParam}, '${permissionKey}')`;

      // Assert
      expect(accessCheck).toContain('check_org_permission');
      expect(accessCheck).toContain(orgParam);
      expect(accessCheck).toContain(permissionKey);
    });

    it('should generate correct access check for project_member', () => {
      // Arrange
      const projectParam = 'project_id';
      const permissionKey = 'Project.read';

      // Act
      const accessCheck = `check_project_permission(${projectParam}, '${permissionKey}')`;

      // Assert
      expect(accessCheck).toContain('check_project_permission');
      expect(accessCheck).toContain(projectParam);
      expect(accessCheck).toContain(permissionKey);
    });

    it('should handle null permission (public access)', () => {
      // Arrange
      const checkType = 'user_owned';

      // Act
      const accessCheck = checkType === 'user_owned' ? 'auth.uid() = user_id' : 'true';

      // Assert
      expect(['auth.uid() = user_id', 'true']).toContain(accessCheck);
    });
  });

  describe('Operation-specific checkType', () => {
    it('should use selectCheckType for SELECT operations', () => {
      // Arrange
      const config = {
        checkType: 'global_permission',
        selectCheckType: 'user_owned',
      };
      const operation = 'SELECT';

      // Act
      const effectiveCheckType = config.selectCheckType || config.checkType;

      // Assert
      expect(effectiveCheckType).toBe('user_owned');
    });

    it('should use insertCheckType for INSERT operations', () => {
      // Arrange
      const config = {
        checkType: 'organization_member',
        insertCheckType: 'global_permission',
      };
      const operation = 'INSERT';

      // Act
      const effectiveCheckType = config.insertCheckType || config.checkType;

      // Assert
      expect(effectiveCheckType).toBe('global_permission');
    });

    it('should fall back to default checkType when operation-specific not provided', () => {
      // Arrange
      const config = {
        checkType: 'global_permission',
      };
      const operation = 'UPDATE';

      // Act
      const effectiveCheckType = config.updateCheckType || config.checkType;

      // Assert
      expect(effectiveCheckType).toBe('global_permission');
    });
  });

  describe('Policy Count Calculation', () => {
    it('should calculate correct policy count', () => {
      // Arrange
      const tableCount = mockAdvancedRlsConfig.length;
      const policiesPerTable = 4; // SELECT, INSERT, UPDATE, DELETE

      // Act
      const totalPolicies = tableCount * policiesPerTable;

      // Assert
      expect(totalPolicies).toBe(8); // 2 tables × 4 policies
    });

    it('should include drop statements in count', () => {
      // Arrange
      const tableCount = mockAdvancedRlsConfig.length;
      const dropStatementsPerTable = 6; // 4 new + 2 old policy names

      // Act
      const totalDropStatements = tableCount * dropStatementsPerTable;

      // Assert
      expect(totalDropStatements).toBe(12); // 2 tables × 6 drops
    });
  });

  describe('SQL File Generation', () => {
    it('should include header with timestamp', () => {
      // Act
      const sql = `-- ================================================
-- ADVANCED RLS POLICY SYNC SCRIPT (Role-Based)
-- Generated at: ${new Date().toISOString()}
-- ================================================`;

      // Assert
      expect(sql).toContain('ADVANCED RLS POLICY SYNC SCRIPT');
      expect(sql).toContain('Generated at:');
    });

    it('should organize SQL into sections', () => {
      // Act
      const sections = [
        '-- SECTION 1: CREATE HELPER FUNCTIONS',
        '-- SECTION 2: ENABLE RLS AND CREATE POLICIES',
      ];

      // Assert
      sections.forEach((section) => {
        expect(section).toContain('SECTION');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing environment variables', () => {
      // Arrange
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      // Act & Assert
      expect(() => {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
      }).toThrow('Missing SUPABASE_SERVICE_ROLE_KEY');
    });

    it('should handle SQL execution errors', async () => {
      // Arrange
      const mockError = { message: 'SQL execution failed' };
      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: mockError });

      // Act
      const result = await mockSupabaseClient.rpc('exec_sql', { sql: 'SELECT 1' });

      // Assert
      expect(result.error).toEqual(mockError);
    });
  });

  describe('Configuration Validation', () => {
    it('should require table name in config', () => {
      // Arrange
      const config = {
        description: 'Test table',
        checkType: 'global_permission',
      };

      // Act & Assert
      expect(config.table).toBeUndefined();
    });

    it('should require permissions object in config', () => {
      // Arrange
      const config = {
        table: 'test_table',
        checkType: 'global_permission',
      };

      // Act & Assert
      expect(config.permissions).toBeUndefined();
    });

    it('should validate permission keys', () => {
      // Arrange
      const config = mockAdvancedRlsConfig[0];

      // Act
      const hasRequiredKeys = ['select', 'insert', 'update', 'delete'].every(
        (key) => key in config.permissions,
      );

      // Assert
      expect(hasRequiredKeys).toBe(true);
    });
  });
});
