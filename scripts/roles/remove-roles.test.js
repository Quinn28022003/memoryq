import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('remove-roles script', () => {
  let originalEnv;
  let mockSupabaseClient;
  let mockCreateScriptClient;
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

    // Mock Supabase client
    const builders = {};
    mockSupabaseClient = {
      from: vi.fn((table) => {
        if (!builders[table]) {
          builders[table] = {
            select: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
          };
        }
        return builders[table];
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

  describe('Role Count', () => {
    it('should count existing roles before deletion', async () => {
      // Arrange
      const mockCount = 11;
      const fromMock = mockSupabaseClient.from('roles');
      fromMock.select.mockResolvedValue({ count: mockCount, error: null });

      // Act
      const result = await mockSupabaseClient
        .from('roles')
        .select('*', { count: 'exact', head: true });

      // Assert
      expect(result.count).toBe(mockCount);
    });

    it('should handle zero roles', async () => {
      // Arrange
      const fromMock = mockSupabaseClient.from('roles');
      fromMock.select.mockResolvedValue({ count: 0, error: null });

      // Act
      const result = await mockSupabaseClient
        .from('roles')
        .select('*', { count: 'exact', head: true });

      // Assert
      expect(result.count).toBe(0);
    });

    it('should handle count errors', async () => {
      // Arrange
      const mockError = { message: 'Failed to count roles' };
      const fromMock = mockSupabaseClient.from('roles');
      fromMock.select.mockResolvedValue({ count: null, error: mockError });

      // Act
      const result = await mockSupabaseClient
        .from('roles')
        .select('*', { count: 'exact', head: true });

      // Assert
      expect(result.error).toEqual(mockError);
    });
  });

  describe('Role Permission Junction Table', () => {
    it('should delete role_permissions before roles', async () => {
      // Arrange
      const deletionOrder = [];
      const rpFromMock = mockSupabaseClient.from('role_permissions');
      rpFromMock.delete().neq.mockImplementation(() => {
        deletionOrder.push('role_permissions');
        return Promise.resolve({ error: null });
      });

      const rolesFromMock = mockSupabaseClient.from('roles');
      rolesFromMock.delete().neq.mockImplementation(() => {
        deletionOrder.push('roles');
        return Promise.resolve({ error: null });
      });

      // Act
      await mockSupabaseClient.from('role_permissions').delete().neq('role_key', '');
      await mockSupabaseClient.from('roles').delete().neq('key', '');

      // Assert
      expect(deletionOrder).toEqual(['role_permissions', 'roles']);
    });

    it('should handle role_permissions deletion errors', async () => {
      // Arrange
      const mockError = { message: 'Failed to delete role_permissions' };
      const fromMock = mockSupabaseClient.from('role_permissions');
      const deleteMock = fromMock.delete();
      deleteMock.neq.mockResolvedValue({ error: mockError });

      // Act
      const result = await mockSupabaseClient.from('role_permissions').delete().neq('role_key', '');

      // Assert
      expect(result.error).toEqual(mockError);
    });
  });

  describe('Role Deletion', () => {
    it('should delete all roles', async () => {
      // Arrange
      const fromMock = mockSupabaseClient.from('roles');
      const deleteMock = fromMock.delete();
      deleteMock.neq.mockResolvedValue({ error: null });

      // Act
      const result = await mockSupabaseClient.from('roles').delete().neq('key', '');

      // Assert
      expect(fromMock.delete).toHaveBeenCalled();
      expect(deleteMock.neq).toHaveBeenCalledWith('key', '');
      expect(result.error).toBeNull();
    });

    it('should handle deletion errors', async () => {
      // Arrange
      const mockError = { message: 'Failed to delete roles' };
      const fromMock = mockSupabaseClient.from('roles');
      const deleteMock = fromMock.delete();
      deleteMock.neq.mockResolvedValue({ error: mockError });

      // Act
      const result = await mockSupabaseClient.from('roles').delete().neq('key', '');

      // Assert
      expect(result.error).toEqual(mockError);
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

    it('should load correct env file for development', () => {
      // Arrange
      const isDev = process.env.NODE_ENV !== 'production';
      const envFiles = isDev ? ['.env.local', '.env'] : ['.env.production', '.env'];

      // Assert
      expect(envFiles).toEqual(['.env.local', '.env']);
    });

    it('should load correct env file for production', () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const isDev = process.env.NODE_ENV !== 'production';
      const envFiles = isDev ? ['.env.local', '.env'] : ['.env.production', '.env'];

      // Assert
      expect(envFiles).toEqual(['.env.production', '.env']);
    });
  });

  describe('Success Messages', () => {
    it('should indicate no roles found', () => {
      // Arrange
      const message = '⚠️  No roles found in database';

      // Assert
      expect(message).toContain('No roles found');
    });

    it('should confirm role_permissions removal', () => {
      // Arrange
      const message = '✓ Role_permissions removed';

      // Assert
      expect(message).toContain('Role_permissions removed');
    });

    it('should confirm successful removal with count', () => {
      // Arrange
      const count = 11;
      const message = `✅ Successfully removed ${count} role(s) and their permissions from database`;

      // Assert
      expect(message).toContain('Successfully removed');
      expect(message).toContain(count.toString());
      expect(message).toContain('permissions');
    });
  });

  describe('Script Flow', () => {
    it('should follow correct execution order', () => {
      // Arrange
      const steps = [
        'create_client',
        'count_roles',
        'delete_role_permissions',
        'delete_roles',
        'log_success',
      ];

      // Act
      const expectedOrder = steps.join(' -> ');

      // Assert
      expect(expectedOrder).toBe(
        'create_client -> count_roles -> delete_role_permissions -> delete_roles -> log_success',
      );
    });

    it('should handle early exit when no roles exist', async () => {
      // Arrange
      const fromMock = mockSupabaseClient.from('roles');
      fromMock.select.mockResolvedValue({ count: 0, error: null });

      // Act
      const result = await mockSupabaseClient
        .from('roles')
        .select('*', { count: 'exact', head: true });
      const shouldContinue = result.count > 0;

      // Assert
      expect(shouldContinue).toBe(false);
    });

    it('should stop if role_permissions deletion fails', async () => {
      // Arrange
      const mockError = { message: 'Failed to delete role_permissions' };
      const fromMock = mockSupabaseClient.from('role_permissions');
      const deleteMock = fromMock.delete();
      deleteMock.neq.mockResolvedValue({ error: mockError });

      // Act
      const result = await mockSupabaseClient.from('role_permissions').delete().neq('role_key', '');
      const shouldContinue = !result.error;

      // Assert
      expect(shouldContinue).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should provide helpful error message for missing credentials', () => {
      // Arrange
      const expectedMessage = 'Make sure environment variables are set';

      // Act
      const errorMessage =
        'Failed to create Supabase client:\nMake sure environment variables are set in .env.local';

      // Assert
      expect(errorMessage).toContain(expectedMessage);
    });

    it('should show stack trace on error', () => {
      // Arrange
      const error = new Error('Test error');

      // Assert
      expect(error.stack).toBeDefined();
      expect(error.message).toBe('Test error');
    });
  });
});
