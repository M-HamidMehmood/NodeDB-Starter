import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { db } from '../../src/db/connection';
import * as roleQueries from '../../src/db/queries/roles';
import * as schema from '../../src/db/schema';
import { TestDataFactory } from '../helpers/testHelpers';
import { cleanDatabase } from '../setup';

describe('Role Database Queries', () => {
  let testRole: any;
  let testPermission: any;
  let testUser: any;

  beforeEach(async () => {
    await cleanDatabase();

    // Create test data
    testRole = await TestDataFactory.createRole({
      name: 'test_role',
      title: 'Test Role',
      description: 'A role for testing',
      accessLevel: 'organization',
    });

    testPermission = await TestDataFactory.createPermission({
      name: 'test_permission',
      description: 'A permission for testing',
    });

    testUser = await TestDataFactory.createUser({
      roleId: testRole.id,
    });
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  describe('getRoleById', () => {
    test('should get role by id', async () => {
      const role = await roleQueries.getRoleById(testRole.id);

      expect(role).toBeDefined();
      expect(role?.id).toBe(testRole.id);
      expect(role?.name).toBe(testRole.name);
      expect(role?.title).toBe(testRole.title);
    });

    test('should return null for non-existent role', async () => {
      const role = await roleQueries.getRoleById(99999);
      expect(role).toBeNull();
    });
  });

  describe('getRoleByName', () => {
    test('should get role by name', async () => {
      const role = await roleQueries.getRoleByName(testRole.name);

      expect(role).toBeDefined();
      expect(role?.id).toBe(testRole.id);
      expect(role?.name).toBe(testRole.name);
    });

    test('should return null for non-existent role name', async () => {
      const role = await roleQueries.getRoleByName('non_existent_role');
      expect(role).toBeNull();
    });
  });

  describe('getRoleWithPermissions', () => {
    test('should get role with permissions', async () => {
      // Assign permission to role
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      const role = await roleQueries.getRoleWithPermissions(testRole.id);

      expect(role).toBeDefined();
      expect(role?.id).toBe(testRole.id);
      expect(role?.permissions).toBeDefined();
      expect(Array.isArray(role?.permissions)).toBe(true);
      expect(role?.permissions).toHaveLength(1);
      expect(role?.permissions[0].id).toBe(testPermission.id);
    });

    test('should return role with empty permissions array when no permissions assigned', async () => {
      const role = await roleQueries.getRoleWithPermissions(testRole.id);

      expect(role).toBeDefined();
      expect(role?.permissions).toBeDefined();
      expect(role?.permissions).toHaveLength(0);
    });

    test('should return null for non-existent role', async () => {
      const role = await roleQueries.getRoleWithPermissions(99999);
      expect(role).toBeNull();
    });
  });

  describe('createRole', () => {
    test('should create role successfully', async () => {
      const roleData = {
        name: 'new_test_role',
        title: 'New Test Role',
        description: 'A newly created test role',
        accessLevel: 'all',
      };

      const role = await roleQueries.createRole(roleData);

      expect(role).toBeDefined();
      expect(role.name).toBe(roleData.name);
      expect(role.title).toBe(roleData.title);
      expect(role.description).toBe(roleData.description);
      expect(role.accessLevel).toBe(roleData.accessLevel);
    });

    test('should create role with null description', async () => {
      const roleData = {
        name: 'minimal_role',
        title: 'Minimal Role',
        description: null,
        accessLevel: 'any',
      };

      const role = await roleQueries.createRole(roleData);

      expect(role).toBeDefined();
      expect(role.description).toBeNull();
    });

    test('should fail with duplicate role name', async () => {
      const roleData = {
        name: testRole.name, // Duplicate name
        title: 'Duplicate Role',
        accessLevel: 'any',
      };

      await expect(roleQueries.createRole(roleData)).rejects.toThrow();
    });
  });

  describe('updateRole', () => {
    test('should update role successfully', async () => {
      const updateData = {
        title: 'Updated Test Role',
        description: 'Updated description',
        accessLevel: 'all',
      };

      const updatedRole = await roleQueries.updateRole(testRole.id, updateData);

      expect(updatedRole).toBeDefined();
      expect(updatedRole?.title).toBe(updateData.title);
      expect(updatedRole?.description).toBe(updateData.description);
      expect(updatedRole?.accessLevel).toBe(updateData.accessLevel);
    });

    test('should update partial data', async () => {
      const updateData = {
        title: 'Partially Updated Role',
      };

      const updatedRole = await roleQueries.updateRole(testRole.id, updateData);

      expect(updatedRole).toBeDefined();
      expect(updatedRole?.title).toBe(updateData.title);
      expect(updatedRole?.name).toBe(testRole.name); // Should remain unchanged
    });

    test('should return null for non-existent role', async () => {
      const updateData = { title: 'Updated Title' };
      const result = await roleQueries.updateRole(99999, updateData);
      expect(result).toBeNull();
    });
  });

  describe('deleteRole', () => {
    test('should delete role without assigned users', async () => {
      // Create a role without users
      const roleToDelete = await TestDataFactory.createRole({
        name: 'deletable_role',
        title: 'Deletable Role',
      });

      const result = await roleQueries.deleteRole(roleToDelete.id);
      expect(result).toBe(true);

      // Verify role is deleted
      const deletedRole = await roleQueries.getRoleById(roleToDelete.id);
      expect(deletedRole).toBeNull();
    });

    test('should fail to delete role with assigned users', async () => {
      await expect(roleQueries.deleteRole(testRole.id)).rejects.toThrow();
    });

    test('should return false for non-existent role', async () => {
      const result = await roleQueries.deleteRole(99999);
      expect(result).toBe(false);
    });
  });

  describe('getAllRoles', () => {
    beforeEach(async () => {
      // Create additional test roles
      await TestDataFactory.createRole({ name: 'role_a', title: 'Role A' });
      await TestDataFactory.createRole({ name: 'role_b', title: 'Role B' });
      await TestDataFactory.createRole({ name: 'role_c', title: 'Role C' });
    });

    test('should get all roles with default parameters', async () => {
      const result = await roleQueries.getAllRoles({});

      expect(result.roles).toBeDefined();
      expect(Array.isArray(result.roles)).toBe(true);
      expect(result.roles.length).toBeGreaterThan(0);
      expect(result.totalRoles).toBeGreaterThan(0);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);
      expect(result.currentPage).toBe(1);
    });

    test('should support pagination', async () => {
      const result = await roleQueries.getAllRoles({
        page: 1,
        limit: 2,
      });

      expect(result.roles).toHaveLength(2);
      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);
    });

    test('should support search functionality', async () => {
      const result = await roleQueries.getAllRoles({
        search: 'Role A',
      });

      expect(result.roles.length).toBeGreaterThan(0);
      const foundRole = result.roles.find(role => role.title === 'Role A');
      expect(foundRole).toBeDefined();
    });

    test('should support sorting by name', async () => {
      const result = await roleQueries.getAllRoles({
        sortBy: 'name',
        order: 'asc',
      });

      expect(result.roles.length).toBeGreaterThan(1);
      for (let i = 1; i < result.roles.length; i++) {
        expect(result.roles[i - 1].name <= result.roles[i].name).toBe(true);
      }
    });

    test('should support sorting by title descending', async () => {
      const result = await roleQueries.getAllRoles({
        sortBy: 'title',
        order: 'desc',
      });

      expect(result.roles.length).toBeGreaterThan(1);
      for (let i = 1; i < result.roles.length; i++) {
        expect(result.roles[i - 1].title >= result.roles[i].title).toBe(true);
      }
    });

    test('should include stats when requested', async () => {
      // Assign permission to a role
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      const result = await roleQueries.getAllRoles({
        includeStats: true,
      });

      expect(result.roles.length).toBeGreaterThan(0);
      const roleWithStats = result.roles.find(r => r.id === testRole.id);
      expect(roleWithStats).toBeDefined();

      if (roleWithStats && 'userCount' in roleWithStats) {
        expect(roleWithStats.userCount).toBeDefined();
        expect(roleWithStats.permissionCount).toBeDefined();
        expect(roleWithStats.permissions).toBeDefined();
        expect(roleWithStats.userCount).toBe(1); // testUser is assigned
        expect(roleWithStats.permissionCount).toBe(1); // testPermission is assigned
      }
    });
  });

  describe('assignPermissionToRole', () => {
    test('should assign permission to role successfully', async () => {
      await roleQueries.assignPermissionToRole(testRole.id, testPermission.id);

      // Verify assignment
      const roleWithPermissions = await roleQueries.getRoleWithPermissions(testRole.id);
      expect(roleWithPermissions?.permissions).toHaveLength(1);
      expect(roleWithPermissions?.permissions[0].id).toBe(testPermission.id);
    });

    test('should fail with non-existent role', async () => {
      await expect(roleQueries.assignPermissionToRole(99999, testPermission.id)).rejects.toThrow();
    });

    test('should fail with non-existent permission', async () => {
      await expect(roleQueries.assignPermissionToRole(testRole.id, 99999)).rejects.toThrow();
    });

    test('should fail with duplicate assignment', async () => {
      // First assignment
      await roleQueries.assignPermissionToRole(testRole.id, testPermission.id);

      // Second assignment should fail
      await expect(roleQueries.assignPermissionToRole(testRole.id, testPermission.id)).rejects.toThrow();
    });
  });

  describe('removePermissionFromRole', () => {
    beforeEach(async () => {
      // Assign permission for removal tests
      await roleQueries.assignPermissionToRole(testRole.id, testPermission.id);
    });

    test('should remove permission from role successfully', async () => {
      const result = await roleQueries.removePermissionFromRole(testRole.id, testPermission.id);
      expect(result).toBe(true);

      // Verify removal
      const roleWithPermissions = await roleQueries.getRoleWithPermissions(testRole.id);
      expect(roleWithPermissions?.permissions).toHaveLength(0);
    });

    test('should return false for non-assigned permission', async () => {
      const anotherPermission = await TestDataFactory.createPermission({
        name: 'another_permission',
      });

      const result = await roleQueries.removePermissionFromRole(testRole.id, anotherPermission.id);
      expect(result).toBe(false);
    });
  });

  describe('assignMultiplePermissionsToRole', () => {
    test('should assign multiple permissions successfully', async () => {
      const permission2 = await TestDataFactory.createPermission({
        name: 'test_permission_2',
      });
      const permission3 = await TestDataFactory.createPermission({
        name: 'test_permission_3',
      });

      await roleQueries.assignMultiplePermissionsToRole(testRole.id, [
        testPermission.id,
        permission2.id,
        permission3.id,
      ]);

      // Verify assignments
      const roleWithPermissions = await roleQueries.getRoleWithPermissions(testRole.id);
      expect(roleWithPermissions?.permissions).toHaveLength(3);
    });

    test('should skip already assigned permissions', async () => {
      // Pre-assign one permission
      await roleQueries.assignPermissionToRole(testRole.id, testPermission.id);

      const permission2 = await TestDataFactory.createPermission({
        name: 'test_permission_2',
      });

      // Should not throw error and should assign only the new permission
      await roleQueries.assignMultiplePermissionsToRole(testRole.id, [permission2.id]);

      const roleWithPermissions = await roleQueries.getRoleWithPermissions(testRole.id);
      expect(roleWithPermissions?.permissions).toHaveLength(2);
    });

    test('should fail with non-existent role', async () => {
      await expect(roleQueries.assignMultiplePermissionsToRole(99999, [testPermission.id])).rejects.toThrow();
    });

    test('should fail with non-existent permissions', async () => {
      await expect(roleQueries.assignMultiplePermissionsToRole(testRole.id, [99999])).rejects.toThrow();
    });
  });

  describe('getRoleUsers', () => {
    beforeEach(async () => {
      // Create additional users for the test role
      await TestDataFactory.createUser({
        name: 'User A',
        email: 'usera@example.com',
        roleId: testRole.id,
      });
      await TestDataFactory.createUser({
        name: 'User B',
        email: 'userb@example.com',
        roleId: testRole.id,
      });
    });

    test('should get users assigned to role', async () => {
      const result = await roleQueries.getRoleUsers(testRole.id, {});

      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users.length).toBeGreaterThanOrEqual(3); // testUser + 2 additional users
      expect(result.totalUsers).toBeGreaterThanOrEqual(3);
    });

    test('should support pagination for role users', async () => {
      const result = await roleQueries.getRoleUsers(testRole.id, {
        page: 1,
        limit: 2,
      });

      expect(result.users).toHaveLength(2);
      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);
    });

    test('should support user search within role', async () => {
      const result = await roleQueries.getRoleUsers(testRole.id, {
        search: 'User A',
      });

      expect(result.users.length).toBeGreaterThan(0);
      const foundUser = result.users.find(user => user.name === 'User A');
      expect(foundUser).toBeDefined();
    });

    test('should support sorting role users', async () => {
      const result = await roleQueries.getRoleUsers(testRole.id, {
        sortBy: 'name',
        order: 'asc',
      });

      expect(result.users.length).toBeGreaterThan(1);
      for (let i = 1; i < result.users.length; i++) {
        expect(result.users[i - 1].name <= result.users[i].name).toBe(true);
      }
    });

    test('should return empty result for role with no users', async () => {
      const emptyRole = await TestDataFactory.createRole({
        name: 'empty_role',
        title: 'Empty Role',
      });

      const result = await roleQueries.getRoleUsers(emptyRole.id, {});

      expect(result.users).toHaveLength(0);
      expect(result.totalUsers).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });
});
