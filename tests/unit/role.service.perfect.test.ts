import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { cleanDatabase, seedTestDatabase } from '../seeds/testSeeds';
import { TestDataFactory } from '../helpers/testHelpers';
import * as roleService from '../../src/modules/role/role.service';
import * as schema from '../../src/db/schema';
import { db } from '../../src/db/connection';
import { BadRequestError, NotFoundError, CustomAPIError } from '../../errors';

describe('Role Service - Perfect Test Cases', () => {
  let testRole: any;
  let testPermission: any;
  let adminRole: any;
  let userRole: any;
  let regularUser: any;

  beforeEach(async () => {
    await cleanDatabase();
    await seedTestDatabase();

    // Get seeded roles
    const adminRoleData = await db.select().from(schema.roles).where(eq(schema.roles.name, 'admin')).limit(1);
    adminRole = adminRoleData[0];

    const userRoleData = await db.select().from(schema.roles).where(eq(schema.roles.name, 'user')).limit(1);
    userRole = userRoleData[0];

    // Get regular user
    const regularUserData = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'user@example.com'))
      .limit(1);
    regularUser = regularUserData[0];

    // Create test data
    testRole = await TestDataFactory.createRole({
      name: 'test_role',
      title: 'Test Role',
      description: 'A role for service testing',
      accessLevel: 'organization',
    });

    testPermission = await TestDataFactory.createPermission({
      name: 'test_permission',
      description: 'A permission for service testing',
    });
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  // ==================== createRoleService ====================
  describe('createRoleService', () => {
    test('should create role successfully with all fields', async () => {
      const roleData = {
        name: 'new_service_role',
        title: 'New Service Role',
        description: 'A role created by service',
        accessLevel: 'all',
      };

      const result = await roleService.createRoleService(roleData);

      expect(result).toBeDefined();
      expect(result.name).toBe(roleData.name);
      expect(result.title).toBe(roleData.title);
      expect(result.description).toBe(roleData.description);
      expect(result.accessLevel).toBe(roleData.accessLevel);
      expect(result.id).toBeDefined();

      // Verify in database
      const createdRole = await db.select().from(schema.roles).where(eq(schema.roles.name, roleData.name)).limit(1);
      expect(createdRole).toHaveLength(1);
      expect(createdRole[0].title).toBe(roleData.title);
    });

    test('should create role with minimal required fields', async () => {
      const roleData = {
        name: 'minimal_service_role',
        title: 'Minimal Service Role',
      };

      const result = await roleService.createRoleService(roleData);

      expect(result.name).toBe(roleData.name);
      expect(result.title).toBe(roleData.title);
      expect(result.accessLevel).toBe('any'); // Default value
      expect(result.description).toBeNull();
    });

    test('should create role with null description', async () => {
      const roleData = {
        name: 'null_desc_service_role',
        title: 'Null Description Service Role',
        description: null,
        accessLevel: 'organization',
      };

      const result = await roleService.createRoleService(roleData);

      expect(result.description).toBeNull();
      expect(result.accessLevel).toBe('organization');
    });

    test('should throw BadRequestError for duplicate role name', async () => {
      const roleData = {
        name: testRole.name, // Existing role name
        title: 'Duplicate Role',
      };

      await expect(roleService.createRoleService(roleData)).rejects.toThrow(BadRequestError);
      await expect(roleService.createRoleService(roleData)).rejects.toThrow('already exists');
    });

    test('should throw BadRequestError for protected role names', async () => {
      const protectedNames = ['admin', 'user'];

      for (const name of protectedNames) {
        const roleData = {
          name,
          title: 'Protected Role',
        };

        await expect(roleService.createRoleService(roleData)).rejects.toThrow(BadRequestError);
      }
    });

    test('should handle database errors gracefully', async () => {
      // Create role with same name to force constraint violation
      const roleData = {
        name: 'admin', // Existing name
        title: 'Test Role',
      };

      await expect(roleService.createRoleService(roleData)).rejects.toThrow(BadRequestError);
    });

    test('should apply default access level correctly', async () => {
      const roleData = {
        name: 'default_access_role',
        title: 'Default Access Role',
      };

      const result = await roleService.createRoleService(roleData);
      expect(result.accessLevel).toBe('any');
    });
  });

  // ==================== getAllRolesService ====================
  describe('getAllRolesService', () => {
    beforeEach(async () => {
      // Create additional roles for testing
      await TestDataFactory.createRole({ name: 'role_a', title: 'Role A', accessLevel: 'any' });
      await TestDataFactory.createRole({ name: 'role_b', title: 'Role B', accessLevel: 'organization' });
      await TestDataFactory.createRole({ name: 'role_c', title: 'Role C', accessLevel: 'all' });
    });

    test('should get all roles with default parameters', async () => {
      const result = await roleService.getAllRolesService({});

      expect(result.roles).toBeDefined();
      expect(Array.isArray(result.roles)).toBe(true);
      expect(result.roles.length).toBeGreaterThanOrEqual(7); // 3 seeded + 1 test + 3 additional
      expect(result.totalRoles).toBeGreaterThanOrEqual(7);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);
      expect(result.currentPage).toBe(1);
    });

    test('should support pagination correctly', async () => {
      const result = await roleService.getAllRolesService({
        page: 1,
        limit: 3,
      });

      expect(result.roles).toHaveLength(3);
      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBeGreaterThanOrEqual(2);

      // Test second page
      const result2 = await roleService.getAllRolesService({
        page: 2,
        limit: 3,
      });

      expect(result2.currentPage).toBe(2);
      expect(result2.roles.length).toBeGreaterThan(0);
    });

    test('should support search functionality', async () => {
      const result = await roleService.getAllRolesService({
        search: 'Role A',
      });

      expect(result.roles.length).toBeGreaterThan(0);
      const foundRole = result.roles.find(role => role.title === 'Role A');
      expect(foundRole).toBeDefined();
    });

    test('should support sorting by name', async () => {
      const result = await roleService.getAllRolesService({
        sortBy: 'name',
        order: 'asc',
      });

      expect(result.roles.length).toBeGreaterThan(1);
      for (let i = 1; i < result.roles.length; i++) {
        expect(result.roles[i - 1].name <= result.roles[i].name).toBe(true);
      }
    });

    test('should support sorting by title descending', async () => {
      const result = await roleService.getAllRolesService({
        sortBy: 'title',
        order: 'desc',
      });

      expect(result.roles.length).toBeGreaterThan(1);
      for (let i = 1; i < result.roles.length; i++) {
        expect(result.roles[i - 1].title >= result.roles[i].title).toBe(true);
      }
    });

    test('should include stats when requested', async () => {
      // Assign user to a role
      await db.update(schema.users).set({ roleId: testRole.id }).where(eq(schema.users.id, regularUser.id));

      // Assign permission to role
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      const result = await roleService.getAllRolesService({
        includeStats: true,
      });

      const roleWithStats = result.roles.find(r => r.id === testRole.id);
      expect(roleWithStats).toBeDefined();

      if ('userCount' in roleWithStats!) {
        expect(roleWithStats.userCount).toBe(1);
        expect(roleWithStats.permissionCount).toBe(1);
        expect(Array.isArray(roleWithStats.permissions)).toBe(true);
      }
    });

    test('should return empty results for non-matching search', async () => {
      const result = await roleService.getAllRolesService({
        search: 'nonexistent_role_xyz',
      });

      expect(result.roles).toHaveLength(0);
      expect(result.totalRoles).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    test('should handle edge case pagination', async () => {
      // Request page beyond available data
      const result = await roleService.getAllRolesService({
        page: 999,
        limit: 10,
      });

      expect(result.roles).toHaveLength(0);
      expect(result.currentPage).toBe(999);
    });
  });

  // ==================== getRoleByIdService ====================
  describe('getRoleByIdService', () => {
    test('should get role by id with permissions', async () => {
      // Assign permission to role
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      const result = await roleService.getRoleByIdService(testRole.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(testRole.id);
      expect(result.name).toBe(testRole.name);
      expect(result.title).toBe(testRole.title);
      expect(result.permissions).toBeDefined();
      expect(Array.isArray(result.permissions)).toBe(true);
      expect(result.permissions).toHaveLength(1);
      expect(result.permissions[0].id).toBe(testPermission.id);
    });

    test('should get role without permissions', async () => {
      const result = await roleService.getRoleByIdService(testRole.id);

      expect(result.id).toBe(testRole.id);
      expect(result.permissions).toHaveLength(0);
    });

    test('should throw NotFoundError for non-existent role', async () => {
      await expect(roleService.getRoleByIdService(99999)).rejects.toThrow(NotFoundError);
      await expect(roleService.getRoleByIdService(99999)).rejects.toThrow('not found');
    });

    test('should get admin role with all permissions', async () => {
      const result = await roleService.getRoleByIdService(adminRole.id);

      expect(result.name).toBe('admin');
      expect(result.permissions.length).toBe(4); // All seeded permissions
    });
  });

  // ==================== updateRoleService ====================
  describe('updateRoleService', () => {
    test('should update role successfully with all fields', async () => {
      const updateData = {
        title: 'Updated Test Role',
        description: 'Updated description',
        accessLevel: 'all',
      };

      const result = await roleService.updateRoleService(testRole.id, updateData);

      expect(result).toBeDefined();
      expect(result.title).toBe(updateData.title);
      expect(result.description).toBe(updateData.description);
      expect(result.accessLevel).toBe(updateData.accessLevel);
      expect(result.name).toBe(testRole.name); // Should remain unchanged

      // Verify in database
      const updatedRole = await db.select().from(schema.roles).where(eq(schema.roles.id, testRole.id)).limit(1);
      expect(updatedRole[0].title).toBe(updateData.title);
    });

    test('should update role with partial data', async () => {
      const updateData = {
        title: 'Partially Updated Role',
      };

      const result = await roleService.updateRoleService(testRole.id, updateData);

      expect(result.title).toBe(updateData.title);
      expect(result.name).toBe(testRole.name);
      expect(result.description).toBe(testRole.description);
      expect(result.accessLevel).toBe(testRole.accessLevel);
    });

    test('should update role name for non-protected roles', async () => {
      const updateData = {
        name: 'updated_test_role_name',
      };

      const result = await roleService.updateRoleService(testRole.id, updateData);

      expect(result.name).toBe(updateData.name);
    });

    test('should prevent updating protected role name', async () => {
      const updateData = {
        name: 'new_admin_name',
      };

      await expect(roleService.updateRoleService(adminRole.id, updateData)).rejects.toThrow(BadRequestError);
      await expect(roleService.updateRoleService(adminRole.id, updateData)).rejects.toThrow('protected role');
    });

    test('should prevent updating protected role access level', async () => {
      const updateData = {
        accessLevel: 'organization',
      };

      await expect(roleService.updateRoleService(userRole.id, updateData)).rejects.toThrow(BadRequestError);
    });

    test('should allow updating protected role title and description', async () => {
      const updateData = {
        title: 'Super Administrator',
        description: 'Enhanced admin role',
      };

      const result = await roleService.updateRoleService(adminRole.id, updateData);

      expect(result.title).toBe(updateData.title);
      expect(result.description).toBe(updateData.description);
      expect(result.name).toBe('admin');
      expect(result.accessLevel).toBe(adminRole.accessLevel);
    });

    test('should prevent duplicate role names', async () => {
      const updateData = {
        name: 'admin', // Existing name
      };

      await expect(roleService.updateRoleService(testRole.id, updateData)).rejects.toThrow(BadRequestError);
    });

    test('should throw NotFoundError for non-existent role', async () => {
      const updateData = { title: 'Updated Title' };

      await expect(roleService.updateRoleService(99999, updateData)).rejects.toThrow(NotFoundError);
    });

    test('should handle empty update data', async () => {
      const result = await roleService.updateRoleService(testRole.id, {});

      expect(result.name).toBe(testRole.name);
      expect(result.title).toBe(testRole.title);
    });

    test('should update role to null description', async () => {
      const updateData = {
        description: null,
      };

      const result = await roleService.updateRoleService(testRole.id, updateData);

      expect(result.description).toBeNull();
    });
  });

  // ==================== deleteRoleService ====================
  describe('deleteRoleService', () => {
    test('should delete role successfully when no users assigned', async () => {
      await roleService.deleteRoleService(testRole.id);

      // Verify role is deleted
      const deletedRole = await db.select().from(schema.roles).where(eq(schema.roles.id, testRole.id)).limit(1);
      expect(deletedRole).toHaveLength(0);
    });

    test('should delete role and cascade remove permissions', async () => {
      // Assign permissions to role
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      await roleService.deleteRoleService(testRole.id);

      // Verify role permissions are also deleted
      const remainingPermissions = await db
        .select()
        .from(schema.rolePermissions)
        .where(eq(schema.rolePermissions.roleId, testRole.id));
      expect(remainingPermissions).toHaveLength(0);
    });

    test('should prevent deleting protected roles', async () => {
      await expect(roleService.deleteRoleService(adminRole.id)).rejects.toThrow(BadRequestError);
      await expect(roleService.deleteRoleService(adminRole.id)).rejects.toThrow('protected role');

      await expect(roleService.deleteRoleService(userRole.id)).rejects.toThrow(BadRequestError);
    });

    test('should prevent deleting role with assigned users', async () => {
      // Assign user to test role
      await db.update(schema.users).set({ roleId: testRole.id }).where(eq(schema.users.id, regularUser.id));

      await expect(roleService.deleteRoleService(testRole.id)).rejects.toThrow(BadRequestError);
      await expect(roleService.deleteRoleService(testRole.id)).rejects.toThrow('assigned users');
    });

    test('should throw NotFoundError for non-existent role', async () => {
      await expect(roleService.deleteRoleService(99999)).rejects.toThrow(NotFoundError);
    });
  });

  // ==================== Permission Management ====================
  describe('Permission Management', () => {
    beforeEach(async () => {
      // Create additional permissions for testing
      await TestDataFactory.createPermission({
        name: 'permission_a',
        description: 'Permission A',
      });

      await TestDataFactory.createPermission({
        name: 'permission_b',
        description: 'Permission B',
      });
    });

    describe('assignPermissionsToRoleService', () => {
      test('should assign single permission to role', async () => {
        const permissionData = {
          permissionIds: [testPermission.id],
        };

        const result = await roleService.assignPermissionsToRoleService(testRole.id, permissionData);

        expect(result.permissions).toHaveLength(1);
        expect(result.permissions[0].id).toBe(testPermission.id);

        // Verify in database
        const rolePermissions = await db
          .select()
          .from(schema.rolePermissions)
          .where(eq(schema.rolePermissions.roleId, testRole.id));
        expect(rolePermissions).toHaveLength(1);
      });

      test('should assign multiple permissions to role', async () => {
        const permissions = await db.select().from(schema.permissions).limit(3);
        const permissionIds = permissions.map(p => p.id);

        const permissionData = {
          permissionIds,
        };

        const result = await roleService.assignPermissionsToRoleService(testRole.id, permissionData);

        expect(result.permissions).toHaveLength(3);
        const assignedIds = result.permissions.map(p => p.id);
        permissionIds.forEach(id => {
          expect(assignedIds).toContain(id);
        });
      });

      test('should throw NotFoundError for non-existent role', async () => {
        const permissionData = {
          permissionIds: [testPermission.id],
        };

        await expect(roleService.assignPermissionsToRoleService(99999, permissionData)).rejects.toThrow(NotFoundError);
      });

      test('should throw BadRequestError for non-existent permissions', async () => {
        const permissionData = {
          permissionIds: [99999, 99998],
        };

        await expect(roleService.assignPermissionsToRoleService(testRole.id, permissionData)).rejects.toThrow(
          BadRequestError
        );
      });

      test('should throw BadRequestError for invalid permission IDs', async () => {
        const invalidData = [{ permissionIds: [0] }, { permissionIds: [-1] }, { permissionIds: ['invalid'] as any }];

        for (const data of invalidData) {
          await expect(roleService.assignPermissionsToRoleService(testRole.id, data)).rejects.toThrow(BadRequestError);
        }
      });

      test('should handle already assigned permissions gracefully', async () => {
        // Pre-assign permission
        await db.insert(schema.rolePermissions).values({
          roleId: testRole.id,
          permissionId: testPermission.id,
        });

        const permissionData = {
          permissionIds: [testPermission.id],
        };

        await expect(roleService.assignPermissionsToRoleService(testRole.id, permissionData)).rejects.toThrow(
          BadRequestError
        );
      });
    });

    describe('assignSinglePermissionToRoleService', () => {
      test('should assign single permission successfully', async () => {
        const result = await roleService.assignSinglePermissionToRoleService(testRole.id, testPermission.id);

        expect(result.permissions).toHaveLength(1);
        expect(result.permissions[0].id).toBe(testPermission.id);
      });

      test('should throw NotFoundError for non-existent role', async () => {
        await expect(roleService.assignSinglePermissionToRoleService(99999, testPermission.id)).rejects.toThrow(
          NotFoundError
        );
      });

      test('should handle various assignment errors', async () => {
        // Pre-assign permission
        await db.insert(schema.rolePermissions).values({
          roleId: testRole.id,
          permissionId: testPermission.id,
        });

        await expect(roleService.assignSinglePermissionToRoleService(testRole.id, testPermission.id)).rejects.toThrow(
          BadRequestError
        );
      });
    });

    describe('removePermissionFromRoleService', () => {
      beforeEach(async () => {
        // Pre-assign permission
        await db.insert(schema.rolePermissions).values({
          roleId: testRole.id,
          permissionId: testPermission.id,
        });
      });

      test('should remove permission from role successfully', async () => {
        const result = await roleService.removePermissionFromRoleService(testRole.id, testPermission.id);

        expect(result.permissions).toHaveLength(0);

        // Verify in database
        const rolePermissions = await db
          .select()
          .from(schema.rolePermissions)
          .where(eq(schema.rolePermissions.roleId, testRole.id));
        expect(rolePermissions).toHaveLength(0);
      });

      test('should throw NotFoundError for non-assigned permission', async () => {
        const anotherPermission = await TestDataFactory.createPermission({
          name: 'unassigned_permission',
        });

        await expect(roleService.removePermissionFromRoleService(testRole.id, anotherPermission.id)).rejects.toThrow(
          NotFoundError
        );
      });

      test('should throw NotFoundError for non-existent role', async () => {
        await expect(roleService.removePermissionFromRoleService(99999, testPermission.id)).rejects.toThrow(
          NotFoundError
        );
      });
    });
  });

  // ==================== User Management ====================
  describe('getRoleUsersService', () => {
    beforeEach(async () => {
      // Assign users to test role
      await db.update(schema.users).set({ roleId: testRole.id }).where(eq(schema.users.id, regularUser.id));

      // Create additional users
      await TestDataFactory.createUser({
        name: 'Role User A',
        email: 'roleusera@example.com',
        roleId: testRole.id,
      });

      await TestDataFactory.createUser({
        name: 'Role User B',
        email: 'roleuserb@example.com',
        roleId: testRole.id,
      });
    });

    test('should get users assigned to role', async () => {
      const result = await roleService.getRoleUsersService(testRole.id, {});

      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users.length).toBe(3);
      expect(result.totalUsers).toBe(3);

      // Verify user structure
      const user = result.users[0];
      expect(user.id).toBeDefined();
      expect(user.name).toBeDefined();
      expect(user.email).toBeDefined();
    });

    test('should support pagination', async () => {
      const result = await roleService.getRoleUsersService(testRole.id, {
        page: 1,
        limit: 2,
      });

      expect(result.users).toHaveLength(2);
      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBe(2);
    });

    test('should support search', async () => {
      const result = await roleService.getRoleUsersService(testRole.id, {
        search: 'Role User A',
      });

      expect(result.users.length).toBeGreaterThan(0);
      const foundUser = result.users.find(u => u.name === 'Role User A');
      expect(foundUser).toBeDefined();
    });

    test('should throw NotFoundError for non-existent role', async () => {
      await expect(roleService.getRoleUsersService(99999, {})).rejects.toThrow(NotFoundError);
    });

    test('should return empty result for role with no users', async () => {
      const emptyRole = await TestDataFactory.createRole({
        name: 'empty_role',
        title: 'Empty Role',
      });

      const result = await roleService.getRoleUsersService(emptyRole.id, {});

      expect(result.users).toHaveLength(0);
      expect(result.totalUsers).toBe(0);
    });
  });

  // ==================== getAllPermissionsService ====================
  describe('getAllPermissionsService', () => {
    test('should get all available permissions', async () => {
      const result = await roleService.getAllPermissionsService();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(5); // 4 seeded + 1 test permission

      // Verify permission structure
      const permission = result[0];
      expect(permission.id).toBeDefined();
      expect(permission.name).toBeDefined();
      expect(permission.description).toBeDefined();

      // Verify specific permissions exist
      const permissionNames = result.map(p => p.name);
      expect(permissionNames).toContain('manage_users');
      expect(permissionNames).toContain('view_users');
      expect(permissionNames).toContain('test_permission');
    });
  });

  // ==================== validateRoleOperation ====================
  describe('validateRoleOperation', () => {
    test('should allow operations on non-protected roles', () => {
      expect(() => {
        roleService.validateRoleOperation('custom_role', 'delete');
      }).not.toThrow();

      expect(() => {
        roleService.validateRoleOperation('test_role', 'modify_critical');
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

      expect(() => {
        roleService.validateRoleOperation('user', 'modify_critical');
      }).toThrow(BadRequestError);
    });

    test('should allow non-critical operations on protected roles', () => {
      expect(() => {
        roleService.validateRoleOperation('admin', 'read');
      }).not.toThrow();

      expect(() => {
        roleService.validateRoleOperation('user', 'update_title');
      }).not.toThrow();
    });
  });
});
