import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as roleService from '../../src/modules/role/role.service';
import * as roleQueries from '../../src/db/queries/roles';
import { BadRequestError, NotFoundError, CustomAPIError } from '../../errors';

// Mock the database queries
jest.mock('../../src/db/queries/roles');

// Mock the database connection and schema
jest.mock('../../src/db/connection', () => ({
  db: {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    }),
  },
}));

jest.mock('../../src/db/schema', () => ({
  permissions: { id: 'permissions.id' },
  rolePermissions: {},
  users: {},
}));

const mockRoleQueries = roleQueries as jest.Mocked<typeof roleQueries>;

describe('Role Service', () => {
  const mockRole = {
    id: 1,
    name: 'test_role',
    title: 'Test Role',
    description: 'A test role',
    accessLevel: 'any',
  };

  const mockRoleWithPermissions = {
    ...mockRole,
    permissions: [{ id: 1, name: 'test_permission', description: 'Test permission' }],
  };

  const mockPermission = {
    id: 1,
    name: 'test_permission',
    description: 'Test permission',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRoleService', () => {
    test('should create role successfully', async () => {
      const roleData = {
        name: 'new_role',
        title: 'New Role',
        description: 'A new role',
        accessLevel: 'organization',
      };

      mockRoleQueries.getRoleByName.mockResolvedValue(null);
      mockRoleQueries.createRole.mockResolvedValue(mockRole);

      const result = await roleService.createRoleService(roleData);

      expect(mockRoleQueries.getRoleByName).toHaveBeenCalledWith(roleData.name);
      expect(mockRoleQueries.createRole).toHaveBeenCalledWith({
        name: roleData.name,
        title: roleData.title,
        description: roleData.description,
        accessLevel: roleData.accessLevel,
      });
      expect(result).toEqual(mockRole);
    });

    test('should throw error for duplicate role name', async () => {
      const roleData = {
        name: 'existing_role',
        title: 'Existing Role',
      };

      mockRoleQueries.getRoleByName.mockResolvedValue(mockRole);

      await expect(roleService.createRoleService(roleData)).rejects.toThrow(BadRequestError);
      expect(mockRoleQueries.createRole).not.toHaveBeenCalled();
    });

    test('should throw error when creation fails', async () => {
      const roleData = {
        name: 'new_role',
        title: 'New Role',
      };

      mockRoleQueries.getRoleByName.mockResolvedValue(null);
      mockRoleQueries.createRole.mockRejectedValue(new Error('Database error'));

      await expect(roleService.createRoleService(roleData)).rejects.toThrow(CustomAPIError);
    });

    test('should handle default values', async () => {
      const roleData = {
        name: 'minimal_role',
        title: 'Minimal Role',
      };

      mockRoleQueries.getRoleByName.mockResolvedValue(null);
      mockRoleQueries.createRole.mockResolvedValue(mockRole);

      await roleService.createRoleService(roleData);

      expect(mockRoleQueries.createRole).toHaveBeenCalledWith({
        name: roleData.name,
        title: roleData.title,
        description: null,
        accessLevel: 'any',
      });
    });
  });

  describe('getAllRolesService', () => {
    test('should get all roles with default parameters', async () => {
      const mockResult = {
        roles: [mockRole],
        totalRoles: 1,
        totalPages: 1,
        currentPage: 1,
      };

      mockRoleQueries.getAllRoles.mockResolvedValue(mockResult);

      const result = await roleService.getAllRolesService({});

      expect(mockRoleQueries.getAllRoles).toHaveBeenCalledWith({});
      expect(result).toEqual(mockResult);
    });

    test('should pass parameters correctly', async () => {
      const params = {
        page: 2,
        limit: 5,
        sortBy: 'title',
        order: 'desc' as const,
        search: 'test',
        includeStats: true,
      };

      const mockResult = {
        roles: [mockRole],
        totalRoles: 1,
        totalPages: 1,
        currentPage: 2,
      };

      mockRoleQueries.getAllRoles.mockResolvedValue(mockResult);

      const result = await roleService.getAllRolesService(params);

      expect(mockRoleQueries.getAllRoles).toHaveBeenCalledWith(params);
      expect(result).toEqual(mockResult);
    });

    test('should handle query errors', async () => {
      mockRoleQueries.getAllRoles.mockRejectedValue(new Error('Database error'));

      await expect(roleService.getAllRolesService({})).rejects.toThrow(CustomAPIError);
    });
  });

  describe('getRoleByIdService', () => {
    test('should get role by id successfully', async () => {
      mockRoleQueries.getRoleWithPermissions.mockResolvedValue(mockRoleWithPermissions);

      const result = await roleService.getRoleByIdService(1);

      expect(mockRoleQueries.getRoleWithPermissions).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockRoleWithPermissions);
    });

    test('should throw error for non-existent role', async () => {
      mockRoleQueries.getRoleWithPermissions.mockResolvedValue(null);

      await expect(roleService.getRoleByIdService(99)).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateRoleService', () => {
    test('should update role successfully', async () => {
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
      };

      mockRoleQueries.getRoleById.mockResolvedValue(mockRole);
      mockRoleQueries.updateRole.mockResolvedValue({ ...mockRole, ...updateData });
      mockRoleQueries.getRoleWithPermissions.mockResolvedValue({ ...mockRoleWithPermissions, ...updateData });

      const result = await roleService.updateRoleService(1, updateData);

      expect(mockRoleQueries.getRoleById).toHaveBeenCalledWith(1);
      expect(mockRoleQueries.updateRole).toHaveBeenCalledWith(1, updateData);
      expect(mockRoleQueries.getRoleWithPermissions).toHaveBeenCalledWith(1);
      expect(result.title).toBe(updateData.title);
    });

    test('should throw error for non-existent role', async () => {
      mockRoleQueries.getRoleById.mockResolvedValue(null);

      await expect(roleService.updateRoleService(99, {})).rejects.toThrow(NotFoundError);
    });

    test('should prevent modifying protected role name', async () => {
      const protectedRole = { ...mockRole, name: 'admin' };
      const updateData = { name: 'new_admin_name' };

      mockRoleQueries.getRoleById.mockResolvedValue(protectedRole);

      await expect(roleService.updateRoleService(1, updateData)).rejects.toThrow(BadRequestError);
    });

    test('should prevent modifying protected role access level', async () => {
      const protectedRole = { ...mockRole, name: 'user' };
      const updateData = { accessLevel: 'all' };

      mockRoleQueries.getRoleById.mockResolvedValue(protectedRole);

      await expect(roleService.updateRoleService(1, updateData)).rejects.toThrow(BadRequestError);
    });

    test('should prevent duplicate role names', async () => {
      const updateData = { name: 'existing_role' };

      mockRoleQueries.getRoleById.mockResolvedValue(mockRole);
      mockRoleQueries.getRoleByName.mockResolvedValue({ ...mockRole, id: 2 });

      await expect(roleService.updateRoleService(1, updateData)).rejects.toThrow(BadRequestError);
    });

    test('should handle update failure', async () => {
      const updateData = { title: 'Updated Title' };

      mockRoleQueries.getRoleById.mockResolvedValue(mockRole);
      mockRoleQueries.updateRole.mockResolvedValue(null);

      await expect(roleService.updateRoleService(1, updateData)).rejects.toThrow(CustomAPIError);
    });
  });

  describe('deleteRoleService', () => {
    test('should delete role successfully', async () => {
      mockRoleQueries.getRoleById.mockResolvedValue(mockRole);
      mockRoleQueries.deleteRole.mockResolvedValue(true);

      await roleService.deleteRoleService(1);

      expect(mockRoleQueries.getRoleById).toHaveBeenCalledWith(1);
      expect(mockRoleQueries.deleteRole).toHaveBeenCalledWith(1);
    });

    test('should throw error for non-existent role', async () => {
      mockRoleQueries.getRoleById.mockResolvedValue(null);

      await expect(roleService.deleteRoleService(99)).rejects.toThrow(NotFoundError);
    });

    test('should prevent deleting protected roles', async () => {
      const protectedRole = { ...mockRole, name: 'admin' };
      mockRoleQueries.getRoleById.mockResolvedValue(protectedRole);

      await expect(roleService.deleteRoleService(1)).rejects.toThrow(BadRequestError);
    });

    test('should handle role with assigned users', async () => {
      mockRoleQueries.getRoleById.mockResolvedValue(mockRole);
      mockRoleQueries.deleteRole.mockRejectedValue(new Error('Cannot delete role that has assigned users'));

      await expect(roleService.deleteRoleService(1)).rejects.toThrow(BadRequestError);
    });
  });

  describe('assignPermissionsToRoleService', () => {
    test('should assign permissions successfully', async () => {
      const permissionData = { permissionIds: [1, 2] };

      mockRoleQueries.getRoleById.mockResolvedValue(mockRole);

      // Mock the database permission validation
      // eslint-disable-next-line global-require
      const mockDb = require('../../src/db/connection').db;
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      });

      mockRoleQueries.assignMultiplePermissionsToRole.mockResolvedValue(undefined);
      mockRoleQueries.getRoleWithPermissions.mockResolvedValue(mockRoleWithPermissions);

      const result = await roleService.assignPermissionsToRoleService(1, permissionData);

      expect(mockRoleQueries.getRoleById).toHaveBeenCalledWith(1);
      expect(mockRoleQueries.assignMultiplePermissionsToRole).toHaveBeenCalledWith(1, permissionData.permissionIds);
      expect(result).toEqual(mockRoleWithPermissions);
    });

    test('should throw error for non-existent role', async () => {
      const permissionData = { permissionIds: [1] };
      mockRoleQueries.getRoleById.mockResolvedValue(null);

      await expect(roleService.assignPermissionsToRoleService(99, permissionData)).rejects.toThrow(NotFoundError);
    });

    test('should validate permission IDs', async () => {
      const permissionData = { permissionIds: [0, -1] };
      mockRoleQueries.getRoleById.mockResolvedValue(mockRole);

      await expect(roleService.assignPermissionsToRoleService(1, permissionData)).rejects.toThrow(BadRequestError);
    });
  });

  describe('assignSinglePermissionToRoleService', () => {
    test('should assign single permission successfully', async () => {
      mockRoleQueries.getRoleById.mockResolvedValue(mockRole);
      mockRoleQueries.assignPermissionToRole.mockResolvedValue(undefined);
      mockRoleQueries.getRoleWithPermissions.mockResolvedValue(mockRoleWithPermissions);

      const result = await roleService.assignSinglePermissionToRoleService(1, 1);

      expect(mockRoleQueries.assignPermissionToRole).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual(mockRoleWithPermissions);
    });

    test('should handle various assignment errors', async () => {
      mockRoleQueries.getRoleById.mockResolvedValue(mockRole);

      // Test role not found error
      mockRoleQueries.assignPermissionToRole.mockRejectedValue(new Error('Role not found'));
      await expect(roleService.assignSinglePermissionToRoleService(1, 1)).rejects.toThrow(NotFoundError);

      // Test permission not found error
      mockRoleQueries.assignPermissionToRole.mockRejectedValue(new Error('Permission not found'));
      await expect(roleService.assignSinglePermissionToRoleService(1, 1)).rejects.toThrow(NotFoundError);

      // Test already assigned error
      mockRoleQueries.assignPermissionToRole.mockRejectedValue(new Error('Permission already assigned to role'));
      await expect(roleService.assignSinglePermissionToRoleService(1, 1)).rejects.toThrow(BadRequestError);
    });
  });

  describe('removePermissionFromRoleService', () => {
    test('should remove permission successfully', async () => {
      mockRoleQueries.getRoleById.mockResolvedValue(mockRole);
      mockRoleQueries.removePermissionFromRole.mockResolvedValue(true);
      mockRoleQueries.getRoleWithPermissions.mockResolvedValue(mockRoleWithPermissions);

      const result = await roleService.removePermissionFromRoleService(1, 1);

      expect(mockRoleQueries.removePermissionFromRole).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual(mockRoleWithPermissions);
    });

    test('should throw error for non-assigned permission', async () => {
      mockRoleQueries.getRoleById.mockResolvedValue(mockRole);
      mockRoleQueries.removePermissionFromRole.mockResolvedValue(false);

      await expect(roleService.removePermissionFromRoleService(1, 1)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getRoleUsersService', () => {
    test('should get role users successfully', async () => {
      const params = { page: 1, limit: 10 };
      const mockUsersResult = {
        users: [{ id: 1, name: 'Test User', email: 'test@example.com' }],
        totalUsers: 1,
        totalPages: 1,
        currentPage: 1,
      };

      mockRoleQueries.getRoleById.mockResolvedValue(mockRole);
      mockRoleQueries.getRoleUsers.mockResolvedValue(mockUsersResult);

      const result = await roleService.getRoleUsersService(1, params);

      expect(mockRoleQueries.getRoleUsers).toHaveBeenCalledWith(1, params);
      expect(result).toEqual(mockUsersResult);
    });

    test('should throw error for non-existent role', async () => {
      mockRoleQueries.getRoleById.mockResolvedValue(null);

      await expect(roleService.getRoleUsersService(99, {})).rejects.toThrow(NotFoundError);
    });
  });

  describe('getAllPermissionsService', () => {
    test('should get all permissions successfully', async () => {
      const mockPermissions = [mockPermission];

      // Mock successful database response
      // eslint-disable-next-line global-require
      const mockDb = require('../../src/db/connection').db;
      mockDb.select.mockReturnValue({
        from: jest.fn().mockResolvedValue(mockPermissions),
      });

      const result = await roleService.getAllPermissionsService();

      expect(result).toEqual(mockPermissions);
    });

    test('should handle query errors', async () => {
      jest.doMock('../../src/db/connection', () => ({
        db: {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockRejectedValue(new Error('Database error')),
          }),
        },
      }));

      await expect(roleService.getAllPermissionsService()).rejects.toThrow(CustomAPIError);
    });
  });

  describe('validateRoleOperation', () => {
    test('should allow operations on non-protected roles', () => {
      expect(() => {
        roleService.validateRoleOperation('custom_role', 'delete');
      }).not.toThrow();
    });

    test('should prevent deletion of protected roles', () => {
      expect(() => {
        roleService.validateRoleOperation('admin', 'delete');
      }).toThrow(BadRequestError);

      expect(() => {
        roleService.validateRoleOperation('user', 'delete');
      }).toThrow(BadRequestError);
    });

    test('should prevent critical modifications of protected roles', () => {
      expect(() => {
        roleService.validateRoleOperation('admin', 'modify_critical');
      }).toThrow(BadRequestError);
    });

    test('should allow non-critical operations on protected roles', () => {
      expect(() => {
        roleService.validateRoleOperation('admin', 'read');
      }).not.toThrow();
    });
  });
});
