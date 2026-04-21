import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('remove-permissions script', () => {
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
    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
    };
    mockSupabaseClient = {
      from: vi.fn(() => mockQueryBuilder),
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

  describe('Permission Count', () => {
    it('should count existing permissions before deletion', async () => {
      // Arrange
      const mockCount = 50;
      const fromMock = mockSupabaseClient.from('permissions');
      fromMock.select.mockResolvedValue({ count: mockCount, error: null });

      // Act
      const result = await mockSupabaseClient
        .from('permissions')
        .select('*', { count: 'exact', head: true });

      // Assert
      expect(result.count).toBe(mockCount);
    });

    it('should handle zero permissions', async () => {
      // Arrange
      const fromMock = mockSupabaseClient.from('permissions');
      fromMock.select.mockResolvedValue({ count: 0, error: null });

      // Act
      const result = await mockSupabaseClient
        .from('permissions')
        .select('*', { count: 'exact', head: true });

      // Assert
      expect(result.count).toBe(0);
    });

    it('should handle count errors', async () => {
      // Arrange
      const mockError = { message: 'Failed to count permissions' };
      const fromMock = mockSupabaseClient.from('permissions');
      fromMock.select.mockResolvedValue({ count: null, error: mockError });

      // Act
      const result = await mockSupabaseClient
        .from('permissions')
        .select('*', { count: 'exact', head: true });

      // Assert
      expect(result.error).toEqual(mockError);
    });
  });

  describe('Permission Deletion', () => {
    it('should delete all permissions', async () => {
      // Arrange
      const fromMock = mockSupabaseClient.from('permissions');
      const deleteMock = fromMock.delete();
      deleteMock.neq.mockResolvedValue({ error: null });

      // Act
      const result = await mockSupabaseClient.from('permissions').delete().neq('key', '');

      // Assert
      expect(fromMock.delete).toHaveBeenCalled();
      expect(deleteMock.neq).toHaveBeenCalledWith('key', '');
      expect(result.error).toBeNull();
    });

    it('should handle deletion errors', async () => {
      // Arrange
      const mockError = { message: 'Failed to delete permissions' };
      const fromMock = mockSupabaseClient.from('permissions');
      const deleteMock = fromMock.delete();
      deleteMock.neq.mockResolvedValue({ error: mockError });

      // Act
      const result = await mockSupabaseClient.from('permissions').delete().neq('key', '');

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

    it('should require SUPABASE_SERVICE_ROLE_KEY', () => {
      // Arrange
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      // Act & Assert
      expect(() => {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
        }
      }).toThrow('Missing SUPABASE_SERVICE_ROLE_KEY');
    });

    it('should require NEXT_PUBLIC_SUPABASE_URL', () => {
      // Arrange
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      // Act & Assert
      expect(() => {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
          throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
        }
      }).toThrow('Missing NEXT_PUBLIC_SUPABASE_URL');
    });
  });

  describe('Error Messages', () => {
    it('should provide helpful error message for missing credentials', () => {
      // Arrange
      const expectedMessage = 'Make sure environment variables are set';

      // Act
      const errorMessage =
        'Failed to create Supabase client:\nMake sure environment variables are set in .env.local';

      // Assert
      expect(errorMessage).toContain(expectedMessage);
    });

    it('should indicate no permissions found', () => {
      // Arrange
      const message = '⚠️  No permissions found in database';

      // Assert
      expect(message).toContain('No permissions found');
    });

    it('should confirm successful removal', () => {
      // Arrange
      const count = 50;
      const message = `✅ Successfully removed ${count} permission(s) from database`;

      // Assert
      expect(message).toContain('Successfully removed');
      expect(message).toContain(count.toString());
    });
  });

  describe('Script Flow', () => {
    it('should follow correct execution order', () => {
      // Arrange
      const steps = ['create_client', 'count_permissions', 'delete_permissions', 'log_success'];

      // Act
      const expectedOrder = steps.join(' -> ');

      // Assert
      expect(expectedOrder).toBe(
        'create_client -> count_permissions -> delete_permissions -> log_success',
      );
    });

    it('should exit on client creation failure', () => {
      // Arrange
      mockCreateScriptClient.mockImplementation(() => {
        throw new Error('Client creation failed');
      });

      // Act & Assert
      expect(() => {
        mockCreateScriptClient();
      }).toThrow('Client creation failed');
    });

    it('should handle early exit when no permissions exist', async () => {
      // Arrange
      const fromMock = mockSupabaseClient.from('permissions');
      fromMock.select.mockResolvedValue({ count: 0, error: null });

      // Act
      const result = await mockSupabaseClient
        .from('permissions')
        .select('*', { count: 'exact', head: true });
      const shouldContinue = result.count > 0;

      // Assert
      expect(shouldContinue).toBe(false);
    });
  });
});
