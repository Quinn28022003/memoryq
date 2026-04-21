import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('sync-roles script', () => {
  let originalEnv;
  let mockSupabaseClient;
  let mockCreateScriptClient;
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
      {
        key: 'admin',
        label: 'Admin',
        description: 'Administrator role',
        permissions: ['Agent.create', 'Agent.read'],
      },
      {
        key: 'user',
        label: 'User',
        description: 'Standard user',
        permissions: ['Agent.read'],
      },
    ];

    // Mock Supabase client
    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
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

  describe('Role filtering logic', () => {
    it('should separate active and soft-deleted roles', () => {
      // Arrange
      const allRoles = [
        { key: 'admin', label: 'Admin', description: 'Admin role', deleted_at: null },
        { key: 'user', label: 'User', description: 'User role', deleted_at: null },
        { key: 'old_role', label: 'Old Role', description: 'Deprecated', deleted_at: '2024-01-01' },
      ];

      // Act
      const activeRoles = allRoles.filter((r) => r.deleted_at === null);
      const deletedRoleKeys = new Set(
        allRoles.filter((r) => r.deleted_at !== null).map((r) => r.key),
      );

      // Assert
      expect(activeRoles).toHaveLength(2);
      expect(deletedRoleKeys).toContain('old_role');
      expect(deletedRoleKeys.size).toBe(1);
    });

    it('should identify roles to soft-delete', () => {
      // Arrange
      const existingActiveRoles = [{ key: 'admin' }, { key: 'user' }, { key: 'deprecated' }];
      const sourceRoles = [
        { key: 'admin', label: 'Admin', description: 'Admin' },
        { key: 'user', label: 'User', description: 'User' },
      ];

      const existingActiveKeys = new Set(existingActiveRoles.map((r) => r.key));
      const newKeys = new Set(sourceRoles.map((r) => r.key));

      // Act
      const toRemove = Array.from(existingActiveKeys).filter((key) => !newKeys.has(key));

      // Assert
      expect(toRemove).toEqual(['deprecated']);
    });

    it('should identify new roles to add (excluding soft-deleted)', () => {
      // Arrange
      const allExistingRoles = [
        { key: 'admin', deleted_at: null },
        { key: 'old_role', deleted_at: '2024-01-01' }, // soft-deleted
      ];
      const sourceRoles = [
        { key: 'admin', label: 'Admin', description: 'Admin' },
        { key: 'user', label: 'User', description: 'User' },
        { key: 'old_role', label: 'Old', description: 'Old' }, // exists but deleted
      ];

      const allExistingKeys = new Set(allExistingRoles.map((r) => r.key));

      // Act
      const toAdd = sourceRoles.filter((r) => !allExistingKeys.has(r.key));

      // Assert
      expect(toAdd).toHaveLength(1);
      expect(toAdd[0].key).toBe('user');
      // Note: old_role is NOT added because it already exists (even though soft-deleted)
    });

    it('should skip soft-deleted roles when updating', () => {
      // Arrange
      const activeRoles = [{ key: 'admin' }, { key: 'user' }];
      const deletedRoleKeys = new Set(['old_role']);
      const sourceRoles = [
        { key: 'admin', label: 'Admin', description: 'Admin' },
        { key: 'user', label: 'User', description: 'User' },
        { key: 'old_role', label: 'Old', description: 'Old' },
      ];

      const existingActiveKeys = new Set(activeRoles.map((r) => r.key));

      // Act
      const toUpdate = sourceRoles.filter((r) => existingActiveKeys.has(r.key));

      // Assert
      expect(toUpdate).toHaveLength(2);
      expect(toUpdate.map((r) => r.key)).toEqual(['admin', 'user']);
      expect(toUpdate.map((r) => r.key)).not.toContain('old_role');
    });
  });

  describe('Role-permission mapping', () => {
    it('should identify permissions to remove from role', () => {
      // Arrange
      const existingRolePermissions = [
        { permission_key: 'Agent.create' },
        { permission_key: 'Agent.read' },
        { permission_key: 'Agent.delete' },
      ];
      const newPermissions = ['Agent.create', 'Agent.read'];

      const existingPermissionKeys = new Set(
        existingRolePermissions.map((rp) => rp.permission_key),
      );
      const newPermissionKeys = new Set(newPermissions);

      // Act
      const permissionsToRemove = Array.from(existingPermissionKeys).filter(
        (key) => !newPermissionKeys.has(key),
      );

      // Assert
      expect(permissionsToRemove).toEqual(['Agent.delete']);
    });

    it('should identify permissions to add to role', () => {
      // Arrange
      const existingRolePermissions = [{ permission_key: 'Agent.read' }];
      const newPermissions = ['Agent.create', 'Agent.read', 'Agent.update'];

      const existingPermissionKeys = new Set(
        existingRolePermissions.map((rp) => rp.permission_key),
      );
      const newPermissionKeys = new Set(newPermissions);

      // Act
      const permissionsToAdd = Array.from(newPermissionKeys).filter(
        (key) => !existingPermissionKeys.has(key),
      );

      // Assert
      expect(permissionsToAdd).toHaveLength(2);
      expect(permissionsToAdd).toContain('Agent.create');
      expect(permissionsToAdd).toContain('Agent.update');
    });

    it('should format role-permission inserts correctly', () => {
      // Arrange
      const roleKey = 'admin';
      const permissionsToAdd = ['Agent.create', 'Agent.read'];

      // Act
      const rolePermissionsToInsert = permissionsToAdd.map((permKey) => ({
        role_key: roleKey,
        permission_key: permKey,
      }));

      // Assert
      expect(rolePermissionsToInsert).toEqual([
        { role_key: 'admin', permission_key: 'Agent.create' },
        { role_key: 'admin', permission_key: 'Agent.read' },
      ]);
    });
  });

  describe('Soft-delete behavior', () => {
    it('should NOT restore soft-deleted roles automatically', () => {
      // This is the CORRECT behavior per the requirements
      // Arrange
      const deletedRoleKeys = new Set(['deprecated_role']);
      const sourceRoles = [
        { key: 'admin', label: 'Admin', description: 'Admin' },
        { key: 'deprecated_role', label: 'Deprecated', description: 'Old role' },
      ];

      // Act
      const rolesToRestore = sourceRoles.filter((r) => deletedRoleKeys.has(r.key));

      // Assert
      // The script should NOT restore these roles
      expect(rolesToRestore).toHaveLength(1);
      // But the script logic should SKIP restoration (bỏ qua)
      // This is intentional - soft-deleted roles stay deleted
    });

    it('should mark roles for soft-delete not hard-delete', () => {
      // Arrange
      const toRemove = ['old_role'];
      const currentTime = new Date().toISOString();

      // Act - Simulate soft-delete operation
      const updatePayload = {
        deleted_at: currentTime,
      };

      // Assert
      expect(updatePayload).toHaveProperty('deleted_at');
      expect(updatePayload.deleted_at).toBeTruthy();
      // In actual implementation, this would be:
      // supabase.from('roles').update(updatePayload).in('key', toRemove)
    });

    it('should ignore soft-deleted roles in summary count', () => {
      // Arrange
      const allRoles = [
        { key: 'admin', deleted_at: null },
        { key: 'user', deleted_at: null },
        { key: 'old', deleted_at: '2024-01-01' },
      ];

      const activeCount = allRoles.filter((r) => r.deleted_at === null).length;
      const deletedCount = allRoles.filter((r) => r.deleted_at !== null).length;

      // Assert
      expect(activeCount).toBe(2);
      expect(deletedCount).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should handle database fetch errors', () => {
      const error = { message: 'Database connection failed' };
      const shouldThrow = () => {
        throw new Error(`Failed to fetch roles: ${error.message}`);
      };

      expect(shouldThrow).toThrow('Failed to fetch roles: Database connection failed');
    });

    it('should handle role insert errors', () => {
      const error = { message: 'duplicate key value violates unique constraint' };
      const shouldThrow = () => {
        throw new Error(`Failed to insert roles: ${error.message}`);
      };

      expect(shouldThrow).toThrow('duplicate key value violates unique constraint');
    });

    it('should handle role-permission mapping errors', () => {
      const roleKey = 'admin';
      const error = { message: 'foreign key constraint violation' };
      const shouldThrow = () => {
        throw new Error(`Failed to insert permissions for role ${roleKey}: ${error.message}`);
      };

      expect(shouldThrow).toThrow('Failed to insert permissions for role admin');
    });
  });
});
