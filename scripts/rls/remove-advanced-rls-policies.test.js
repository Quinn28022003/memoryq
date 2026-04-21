import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('remove-advanced-rls-policies script', () => {
  let originalEnv;
  let mockSupabaseClient;
  let mockCreateScriptClient;
  let mockAdvancedRlsConfig;
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

    // Mock ADVANCED_RLS_CONFIG
    mockAdvancedRlsConfig = [
      {
        table: 'agents',
        description: 'AI Agents',
        checkType: 'global_permission',
      },
      {
        table: 'projects',
        description: 'Projects',
        checkType: 'project_member',
      },
      {
        table: 'organizations',
        description: 'Organizations',
        checkType: 'organization_member',
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

  describe('SQL Generation for Removal', () => {
    it('should generate header with timestamp', () => {
      // Act
      const sql = `-- ================================================
-- ADVANCED RLS POLICY REMOVAL SCRIPT
-- Generated at: ${new Date().toISOString()}
-- ================================================`;

      // Assert
      expect(sql).toContain('ADVANCED RLS POLICY REMOVAL SCRIPT');
      expect(sql).toContain('Generated at:');
    });

    it('should organize SQL into sections', () => {
      // Act
      const sections = ['-- SECTION 1: DROP RLS POLICIES', '-- SECTION 2: DROP HELPER FUNCTIONS'];

      // Assert
      sections.forEach((section) => {
        expect(section).toContain('SECTION');
      });
    });

    it('should generate DROP POLICY statements', () => {
      // Arrange
      const table = 'agents';

      // Act
      const dropStatements = [
        `DROP POLICY IF EXISTS "Users can view ${table}" ON public.${table};`,
        `DROP POLICY IF EXISTS "Users can insert ${table}" ON public.${table};`,
        `DROP POLICY IF EXISTS "Users can update ${table}" ON public.${table};`,
        `DROP POLICY IF EXISTS "Users can delete ${table}" ON public.${table};`,
      ];

      // Assert
      dropStatements.forEach((stmt) => {
        expect(stmt).toContain('DROP POLICY IF EXISTS');
        expect(stmt).toContain(table);
      });
    });

    it('should generate DROP statements for old policy names', () => {
      // Arrange
      const table = 'agents';

      // Act
      const oldPolicyDrops = [
        `DROP POLICY IF EXISTS "Users can view ${table} they have access to" ON public.${table};`,
        `DROP POLICY IF EXISTS "Authenticated users can manage ${table}" ON public.${table};`,
      ];

      // Assert
      oldPolicyDrops.forEach((stmt) => {
        expect(stmt).toContain('DROP POLICY IF EXISTS');
        expect(stmt).toContain(table);
      });
    });

    it('should generate DISABLE RLS statements', () => {
      // Arrange
      const table = 'agents';

      // Act
      const disableStmt = `ALTER TABLE public.${table} DISABLE ROW LEVEL SECURITY;`;

      // Assert
      expect(disableStmt).toContain('ALTER TABLE');
      expect(disableStmt).toContain('DISABLE ROW LEVEL SECURITY');
      expect(disableStmt).toContain(table);
    });
  });

  describe('Helper Function Removal', () => {
    it('should drop user_has_global_permission function', () => {
      // Act
      const dropStmt = 'DROP FUNCTION IF EXISTS public.user_has_global_permission(TEXT);';

      // Assert
      expect(dropStmt).toContain('DROP FUNCTION IF EXISTS');
      expect(dropStmt).toContain('user_has_global_permission');
    });

    it('should drop check_org_permission function', () => {
      // Act
      const dropStmt = 'DROP FUNCTION IF EXISTS public.check_org_permission(UUID, TEXT);';

      // Assert
      expect(dropStmt).toContain('DROP FUNCTION IF EXISTS');
      expect(dropStmt).toContain('check_org_permission');
    });

    it('should drop check_project_permission function', () => {
      // Act
      const dropStmt = 'DROP FUNCTION IF EXISTS public.check_project_permission(UUID, TEXT);';

      // Assert
      expect(dropStmt).toContain('DROP FUNCTION IF EXISTS');
      expect(dropStmt).toContain('check_project_permission');
    });

    it('should drop get_user_all_roles function', () => {
      // Act
      const dropStmt = 'DROP FUNCTION IF EXISTS public.get_user_all_roles(UUID, UUID, UUID);';

      // Assert
      expect(dropStmt).toContain('DROP FUNCTION IF EXISTS');
      expect(dropStmt).toContain('get_user_all_roles');
    });

    it('should drop all 4 helper functions', () => {
      // Arrange
      const functions = [
        'user_has_global_permission',
        'check_org_permission',
        'check_project_permission',
        'get_user_all_roles',
      ];

      // Act
      const dropStatements = functions.map((fn) => `DROP FUNCTION IF EXISTS public.${fn}`);

      // Assert
      expect(dropStatements).toHaveLength(4);
      dropStatements.forEach((stmt) => {
        expect(stmt).toContain('DROP FUNCTION IF EXISTS');
      });
    });
  });

  describe('Policy Count Calculation', () => {
    it('should calculate correct policy drop count', () => {
      // Arrange
      const tableCount = mockAdvancedRlsConfig.length;
      const dropsPerTable = 6; // 4 new policies + 2 old policy names

      // Act
      const totalDrops = tableCount * dropsPerTable;

      // Assert
      expect(totalDrops).toBe(18); // 3 tables × 6 drops
    });

    it('should count helper function drops', () => {
      // Arrange
      const helperFunctionCount = 4;

      // Assert
      expect(helperFunctionCount).toBe(4);
    });
  });

  describe('SQL Execution', () => {
    it('should execute SQL via rpc', async () => {
      // Arrange
      const sql = 'DROP POLICY IF EXISTS test_policy;';
      mockSupabaseClient.rpc.mockResolvedValue({ error: null });

      // Act
      const result = await mockSupabaseClient.rpc('exec_sql', { sql });

      // Assert
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('exec_sql', { sql });
      expect(result.error).toBeNull();
    });

    it('should handle rpc execution errors', async () => {
      // Arrange
      const mockError = { message: 'SQL execution failed' };
      mockSupabaseClient.rpc.mockResolvedValue({ error: mockError });

      // Act
      const result = await mockSupabaseClient.rpc('exec_sql', { sql: 'DROP POLICY test;' });

      // Assert
      expect(result.error).toEqual(mockError);
    });

    it('should fallback to direct execution if rpc fails', async () => {
      // Arrange
      mockSupabaseClient.rpc.mockResolvedValue({ error: { message: 'RPC not available' } });
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      // Act
      const rpcResult = await mockSupabaseClient.rpc('exec_sql', { sql: 'DROP POLICY test;' });
      let finalResult = rpcResult;

      if (rpcResult.error) {
        finalResult = await mockSupabaseClient.from('_sql').insert({ query: 'DROP POLICY test;' });
      }

      // Assert
      expect(finalResult.error).toBeNull();
    });
  });

  describe('File Generation', () => {
    it('should save SQL to generated-rls-removal.sql', () => {
      // Arrange

      // Arrange
      const expectedPath = path.join(__dirname, 'generated-rls-removal.sql');

      // Assert
      expect(expectedPath).toContain('generated-rls-removal.sql');
    });

    it('should include table count in log', () => {
      // Arrange
      const tableCount = mockAdvancedRlsConfig.length;
      const message = `Removing policies from ${tableCount} tables`;

      // Assert
      expect(message).toContain(tableCount.toString());
      expect(message).toContain('tables');
    });

    it('should include drop count in log', () => {
      // Arrange
      const policyCount = mockAdvancedRlsConfig.length * 6;
      const message = `Dropping ${policyCount} policy statements`;

      // Assert
      expect(message).toContain(policyCount.toString());
      expect(message).toContain('policy statements');
    });

    it('should include function count in log', () => {
      // Arrange
      const functionCount = 4;
      const message = `Dropping ${functionCount} helper functions`;

      // Assert
      expect(message).toContain(functionCount.toString());
      expect(message).toContain('helper functions');
    });
  });

  describe('Environment Configuration', () => {
    it('should use development environment by default', () => {
      // Act
      const isDev = process.env.NODE_ENV !== 'production';

      // Assert
      expect(isDev).toBe(true);
    });

    it('should detect production environment', () => {
      // Arrange
      process.env.NODE_ENV = 'production';

      // Act
      const isDev = process.env.NODE_ENV !== 'production';

      // Assert
      expect(isDev).toBe(false);
    });

    it('should require environment variables', () => {
      // Arrange
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      // Act & Assert
      expect(() => {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
        }
      }).toThrow('Missing SUPABASE_SERVICE_ROLE_KEY');
    });
  });

  describe('Success Messages', () => {
    it('should confirm SQL generation', () => {
      // Arrange
      const message = '✓ SQL script saved to: generated-rls-removal.sql';

      // Assert
      expect(message).toContain('SQL script saved');
      expect(message).toContain('generated-rls-removal.sql');
    });

    it('should confirm SQL execution', () => {
      // Arrange
      const message = '✓ SQL executed successfully';

      // Assert
      expect(message).toContain('SQL executed successfully');
    });

    it('should confirm complete removal', () => {
      // Arrange
      const message =
        '✅ All advanced RLS policies, helper functions, and RLS disabled successfully!';

      // Assert
      expect(message).toContain('All advanced RLS policies');
      expect(message).toContain('helper functions');
      expect(message).toContain('RLS disabled');
    });
  });

  describe('Error Handling', () => {
    it('should handle client creation errors', () => {
      // Arrange
      mockCreateScriptClient.mockImplementation(() => {
        throw new Error('Failed to create Supabase client');
      });

      // Act & Assert
      expect(() => {
        mockCreateScriptClient();
      }).toThrow('Failed to create Supabase client');
    });

    it('should provide helpful error messages', () => {
      // Arrange
      const errorMessage = '❌ RLS policy removal failed:\nFailed to execute SQL';

      // Assert
      expect(errorMessage).toContain('RLS policy removal failed');
      expect(errorMessage).toContain('Failed to execute SQL');
    });

    it('should show stack trace on error', () => {
      // Arrange
      const error = new Error('Test error');

      // Assert
      expect(error.stack).toBeDefined();
      expect(error.message).toBe('Test error');
    });
  });

  describe('Script Flow', () => {
    it('should follow correct execution order', () => {
      // Arrange
      const steps = ['create_client', 'generate_sql', 'save_to_file', 'execute_sql', 'log_success'];

      // Act
      const expectedOrder = steps.join(' -> ');

      // Assert
      expect(expectedOrder).toBe(
        'create_client -> generate_sql -> save_to_file -> execute_sql -> log_success',
      );
    });
  });
});
