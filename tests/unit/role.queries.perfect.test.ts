import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { cleanDatabase, seedTestDatabase } from '../seeds/testSeeds';
import { TestDataFactory } from '../helpers/testHelpers';
import * as roleQueries from '../../src/db/queries/roles';
import * as schema from '../../src/db/schema';
import { db } from '../../src/db/connection';

describe('Role Database Queries - Perfect Test Cases', () => {
  let testRole: any;
  let testPermission: any;
  let adminRole: any;
  let userRole: any;
  let regularUser: any;

  beforeEach(async () => {
    await cleanDatabase();
    await seedTestDatabase();

    // Get seeded roles
    const adminRoleData = await db.select().from(schema.roles).where(schema.eq(schema.roles.name, 'admin')).limit(1);
    adminRole = adminRoleData[0];

    const userRoleData = await db.select().from(schema.roles).where(schema.eq(schema.roles.name, 'user')).limit(1);
    userRole = userRoleData[0];

    // Get regular user
    const regularUserData = await db
      .select()
      .from(schema.users)
      .where(schema.eq(schema.users.email, 'user@example.com'))
      .limit(1);
    regularUser = regularUserData[0];

    // Create test data
    testRole = await TestDataFactory.createRole({
      name: 'test_role',
      title: 'Test Role',
      description: 'A role for database query testing',
      accessLevel: 'organization',
    });

    testPermission = await TestDataFactory.createPermission({
      name: 'test_permission',
      description: 'A permission for database query testing',
    });
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  // ==================== createRole ====================
  describe('createRole', () => {
    test('should create role with all fields', async () => {
      const roleData = {
        name: 'query_test_role',
        title: 'Query Test Role',
        description: 'A role created by query test',
        accessLevel: 'all' as const,
      };

      const result = await roleQueries.createRole(roleData);

      expect(result).toBeDefined();
      expect(result.name).toBe(roleData.name);
      expect(result.title).toBe(roleData.title);
      expect(result.description).toBe(roleData.description);
      expect(result.accessLevel).toBe(roleData.accessLevel);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();

      // Verify in database
      const createdRole = await db
        .select()
        .from(schema.roles)
        .where(schema.eq(schema.roles.name, roleData.name))
        .limit(1);
      expect(createdRole).toHaveLength(1);
      expect(createdRole[0].title).toBe(roleData.title);
    });

    test('should create role with minimal fields', async () => {
      const roleData = {
        name: 'minimal_query_role',
        title: 'Minimal Query Role',
      };

      const result = await roleQueries.createRole(roleData);

      expect(result.name).toBe(roleData.name);
      expect(result.title).toBe(roleData.title);
      expect(result.accessLevel).toBe('any'); // Default value
      expect(result.description).toBeNull();
    });

    test('should create role with null description', async () => {
      const roleData = {
        name: 'null_desc_query_role',
        title: 'Null Description Query Role',
        description: null,
        accessLevel: 'organization' as const,
      };

      const result = await roleQueries.createRole(roleData);

      expect(result.description).toBeNull();
      expect(result.accessLevel).toBe('organization');
    });

    test('should handle database constraint violations', async () => {
      const roleData = {
        name: testRole.name, // Duplicate name
        title: 'Duplicate Role',
      };

      await expect(roleQueries.createRole(roleData)).rejects.toThrow();
    });

    test('should set correct timestamps', async () => {
      const beforeCreate = new Date();

      const roleData = {
        name: 'timestamp_test_role',
        title: 'Timestamp Test Role',
      };

      const result = await roleQueries.createRole(roleData);

      const afterCreate = new Date();

      expect(new Date(result.createdAt)).toBeInstanceOf(Date);
      expect(new Date(result.updatedAt)).toBeInstanceOf(Date);
      expect(new Date(result.createdAt).getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(new Date(result.createdAt).getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });
  });

  // ==================== getAllRoles ====================
  describe('getAllRoles', () => {
    beforeEach(async () => {
      // Create additional roles for comprehensive testing
      await TestDataFactory.createRole({ name: 'alpha_role', title: 'Alpha Role', accessLevel: 'any' });
      await TestDataFactory.createRole({ name: 'beta_role', title: 'Beta Role', accessLevel: 'organization' });
      await TestDataFactory.createRole({ name: 'gamma_role', title: 'Gamma Role', accessLevel: 'all' });
      await TestDataFactory.createRole({
        name: 'special_role',
        title: 'Special Test Role',
        description: 'Special description',
      });
    });

    test('should get all roles with default parameters', async () => {
      const result = await roleQueries.getAllRoles({});

      expect(result.roles).toBeDefined();
      expect(Array.isArray(result.roles)).toBe(true);
      expect(result.roles.length).toBeGreaterThanOrEqual(8); // 3 seeded + 1 test + 4 additional
      expect(result.totalRoles).toBeGreaterThanOrEqual(8);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);
      expect(result.currentPage).toBe(1);

      // Verify role structure
      const role = result.roles[0];
      expect(role.id).toBeDefined();
      expect(role.name).toBeDefined();
      expect(role.title).toBeDefined();
      expect(role.accessLevel).toBeDefined();
      expect(role.createdAt).toBeDefined();
      expect(role.updatedAt).toBeDefined();
    });

    test('should support pagination correctly', async () => {
      const page1 = await roleQueries.getAllRoles({ page: 1, limit: 3 });

      expect(page1.roles).toHaveLength(3);
      expect(page1.currentPage).toBe(1);
      expect(page1.totalPages).toBeGreaterThanOrEqual(2);

      const page2 = await roleQueries.getAllRoles({ page: 2, limit: 3 });

      expect(page2.currentPage).toBe(2);
      expect(page2.roles.length).toBeGreaterThan(0);

      // Verify no overlap between pages
      const page1Ids = page1.roles.map(r => r.id);
      const page2Ids = page2.roles.map(r => r.id);
      const intersection = page1Ids.filter(id => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });

    test('should support search by name', async () => {
      const result = await roleQueries.getAllRoles({ search: 'admin' });

      expect(result.roles.length).toBeGreaterThan(0);
      const foundRole = result.roles.find(r => r.name === 'admin');
      expect(foundRole).toBeDefined();
    });

    test('should support search by title', async () => {
      const result = await roleQueries.getAllRoles({ search: 'Special Test' });

      expect(result.roles.length).toBeGreaterThan(0);
      const foundRole = result.roles.find(r => r.title.includes('Special Test'));
      expect(foundRole).toBeDefined();
      expect(foundRole.name).toBe('special_role');
    });

    test('should support search by description', async () => {
      const result = await roleQueries.getAllRoles({ search: 'Special description' });

      expect(result.roles.length).toBeGreaterThan(0);
      const foundRole = result.roles.find(r => r.description?.includes('Special description'));
      expect(foundRole).toBeDefined();
    });

    test('should support case-insensitive search', async () => {
      const result = await roleQueries.getAllRoles({ search: 'ADMIN' });

      expect(result.roles.length).toBeGreaterThan(0);
      const foundRole = result.roles.find(r => r.name === 'admin');
      expect(foundRole).toBeDefined();
    });

    test('should support sorting by name ascending', async () => {
      const result = await roleQueries.getAllRoles({ sortBy: 'name', order: 'asc' });

      expect(result.roles.length).toBeGreaterThan(1);
      for (let i = 1; i < result.roles.length; i++) {
        expect(result.roles[i - 1].name <= result.roles[i].name).toBe(true);
      }
    });

    test('should support sorting by name descending', async () => {
      const result = await roleQueries.getAllRoles({ sortBy: 'name', order: 'desc' });

      expect(result.roles.length).toBeGreaterThan(1);
      for (let i = 1; i < result.roles.length; i++) {
        expect(result.roles[i - 1].name >= result.roles[i].name).toBe(true);
      }
    });

    test('should support sorting by title', async () => {
      const result = await roleQueries.getAllRoles({ sortBy: 'title', order: 'asc' });

      expect(result.roles.length).toBeGreaterThan(1);
      for (let i = 1; i < result.roles.length; i++) {
        expect(result.roles[i - 1].title <= result.roles[i].title).toBe(true);
      }
    });

    test('should support sorting by createdAt', async () => {
      const result = await roleQueries.getAllRoles({ sortBy: 'createdAt', order: 'desc' });

      expect(result.roles.length).toBeGreaterThan(1);
      for (let i = 1; i < result.roles.length; i++) {
        const prev = new Date(result.roles[i - 1].createdAt);
        const current = new Date(result.roles[i].createdAt);
        expect(prev.getTime()).toBeGreaterThanOrEqual(current.getTime());
      }
    });

    test('should include stats when requested', async () => {
      // Assign user to a role
      await db.update(schema.users).set({ roleId: testRole.id }).where(schema.eq(schema.users.id, regularUser.id));

      // Assign permission to role
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      const result = await roleQueries.getAllRoles({ includeStats: true });

      const roleWithStats = result.roles.find(r => r.id === testRole.id);
      expect(roleWithStats).toBeDefined();

      if ('userCount' in roleWithStats!) {
        expect(roleWithStats.userCount).toBe(1);
        expect(roleWithStats.permissionCount).toBe(1);
        expect(Array.isArray(roleWithStats.permissions)).toBe(true);
        expect(roleWithStats.permissions[0].name).toBe(testPermission.name);
      }
    });

    test('should return empty result for non-matching search', async () => {
      const result = await roleQueries.getAllRoles({ search: 'nonexistent_role_xyz_123' });

      expect(result.roles).toHaveLength(0);
      expect(result.totalRoles).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    test('should handle edge case pagination', async () => {
      // Request page beyond available data
      const result = await roleQueries.getAllRoles({ page: 999, limit: 10 });

      expect(result.roles).toHaveLength(0);
      expect(result.currentPage).toBe(999);
      expect(result.totalRoles).toBeGreaterThan(0);
    });

    test('should combine search and pagination', async () => {
      const result = await roleQueries.getAllRoles({
        search: 'role',
        page: 1,
        limit: 2,
      });

      expect(result.roles.length).toBeGreaterThanOrEqual(0);
      expect(result.roles.length).toBeLessThanOrEqual(2);
      expect(result.currentPage).toBe(1);
    });

    test('should combine search, sorting, and pagination', async () => {
      const result = await roleQueries.getAllRoles({
        search: 'role',
        sortBy: 'name',
        order: 'asc',
        page: 1,
        limit: 3,
      });

      if (result.roles.length > 1) {
        for (let i = 1; i < result.roles.length; i++) {
          expect(result.roles[i - 1].name <= result.roles[i].name).toBe(true);
        }
      }
    });
  });

  // ==================== getRoleById ====================
  describe('getRoleById', () => {
    test('should get role by id with permissions', async () => {
      // Assign permission to role
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      const result = await roleQueries.getRoleById(testRole.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(testRole.id);
      expect(result.name).toBe(testRole.name);
      expect(result.title).toBe(testRole.title);
      expect(result.description).toBe(testRole.description);
      expect(result.accessLevel).toBe(testRole.accessLevel);
      expect(result.permissions).toBeDefined();
      expect(Array.isArray(result.permissions)).toBe(true);
      expect(result.permissions).toHaveLength(1);
      expect(result.permissions[0].id).toBe(testPermission.id);
      expect(result.permissions[0].name).toBe(testPermission.name);
    });

    test('should get role without permissions', async () => {
      const result = await roleQueries.getRoleById(testRole.id);

      expect(result.id).toBe(testRole.id);
      expect(result.permissions).toHaveLength(0);
    });

    test('should return null for non-existent role', async () => {
      const result = await roleQueries.getRoleById(99999);
      expect(result).toBeNull();
    });

    test('should get role with multiple permissions', async () => {
      // Add multiple permissions
      const permissions = await db.select().from(schema.permissions).limit(3);

      for (const permission of permissions) {
        await db.insert(schema.rolePermissions).values({
          roleId: testRole.id,
          permissionId: permission.id,
        });
      }

      const result = await roleQueries.getRoleById(testRole.id);

      expect(result?.permissions).toHaveLength(3);
      const permissionIds = result?.permissions.map(p => p.id) || [];
      permissions.forEach(p => {
        expect(permissionIds).toContain(p.id);
      });
    });

    test('should include permission descriptions', async () => {
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      const result = await roleQueries.getRoleById(testRole.id);

      expect(result?.permissions[0].description).toBe(testPermission.description);
    });
  });

  // ==================== getRoleByName ====================
  describe('getRoleByName', () => {
    test('should get role by name', async () => {
      const result = await roleQueries.getRoleByName(testRole.name);

      expect(result).toBeDefined();
      expect(result.id).toBe(testRole.id);
      expect(result.name).toBe(testRole.name);
      expect(result.title).toBe(testRole.title);
    });

    test('should return null for non-existent role name', async () => {
      const result = await roleQueries.getRoleByName('nonexistent_role_name');
      expect(result).toBeNull();
    });

    test('should be case sensitive', async () => {
      const result = await roleQueries.getRoleByName('ADMIN');
      expect(result).toBeNull();

      const correctResult = await roleQueries.getRoleByName('admin');
      expect(correctResult).toBeDefined();
      expect(correctResult.name).toBe('admin');
    });

    test('should get seeded roles', async () => {
      const adminResult = await roleQueries.getRoleByName('admin');
      expect(adminResult).toBeDefined();
      expect(adminResult.title).toBe('Administrator');

      const userResult = await roleQueries.getRoleByName('user');
      expect(userResult).toBeDefined();
      expect(userResult.title).toBe('User');
    });
  });

  // ==================== updateRole ====================
  describe('updateRole', () => {
    test('should update role with all fields', async () => {
      const updateData = {
        name: 'updated_test_role',
        title: 'Updated Test Role',
        description: 'Updated description',
        accessLevel: 'all' as const,
      };

      const result = await roleQueries.updateRole(testRole.id, updateData);

      expect(result).toBeDefined();
      expect(result.name).toBe(updateData.name);
      expect(result.title).toBe(updateData.title);
      expect(result.description).toBe(updateData.description);
      expect(result.accessLevel).toBe(updateData.accessLevel);
      expect(result.id).toBe(testRole.id);

      // Verify in database
      const updatedRole = await db.select().from(schema.roles).where(schema.eq(schema.roles.id, testRole.id)).limit(1);
      expect(updatedRole[0].title).toBe(updateData.title);
    });

    test('should update role with partial data', async () => {
      const updateData = {
        title: 'Partially Updated Role',
      };

      const result = await roleQueries.updateRole(testRole.id, updateData);

      expect(result.title).toBe(updateData.title);
      expect(result.name).toBe(testRole.name); // Unchanged
      expect(result.description).toBe(testRole.description); // Unchanged
    });

    test('should update only description', async () => {
      const updateData = {
        description: 'Only description updated',
      };

      const result = await roleQueries.updateRole(testRole.id, updateData);

      expect(result.description).toBe(updateData.description);
      expect(result.name).toBe(testRole.name);
      expect(result.title).toBe(testRole.title);
    });

    test('should update description to null', async () => {
      const updateData = {
        description: null,
      };

      const result = await roleQueries.updateRole(testRole.id, updateData);

      expect(result.description).toBeNull();
    });

    test('should return null for non-existent role', async () => {
      const updateData = { title: 'Updated Title' };
      const result = await roleQueries.updateRole(99999, updateData);
      expect(result).toBeNull();
    });

    test('should handle empty update data', async () => {
      const result = await roleQueries.updateRole(testRole.id, {});

      expect(result.name).toBe(testRole.name);
      expect(result.title).toBe(testRole.title);
      expect(result.description).toBe(testRole.description);
    });

    test('should update timestamps', async () => {
      const originalUpdatedAt = testRole.updatedAt;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updateData = { title: 'Updated for timestamp test' };
      const result = await roleQueries.updateRole(testRole.id, updateData);

      expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime());
    });

    test('should handle constraint violations on update', async () => {
      const updateData = {
        name: 'admin', // Existing name
      };

      await expect(roleQueries.updateRole(testRole.id, updateData)).rejects.toThrow();
    });
  });

  // ==================== deleteRole ====================
  describe('deleteRole', () => {
    test('should delete role successfully', async () => {
      const result = await roleQueries.deleteRole(testRole.id);

      expect(result).toBe(true);

      // Verify role is deleted
      const deletedRole = await db.select().from(schema.roles).where(schema.eq(schema.roles.id, testRole.id)).limit(1);
      expect(deletedRole).toHaveLength(0);
    });

    test('should return false for non-existent role', async () => {
      const result = await roleQueries.deleteRole(99999);
      expect(result).toBe(false);
    });

    test('should cascade delete role permissions', async () => {
      // Assign permissions to role
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      const result = await roleQueries.deleteRole(testRole.id);

      expect(result).toBe(true);

      // Verify role permissions are also deleted
      const remainingPermissions = await db
        .select()
        .from(schema.rolePermissions)
        .where(schema.eq(schema.rolePermissions.roleId, testRole.id));
      expect(remainingPermissions).toHaveLength(0);
    });

    test('should handle foreign key constraints', async () => {
      // Assign user to role
      await db.update(schema.users).set({ roleId: testRole.id }).where(schema.eq(schema.users.id, regularUser.id));

      // Should throw due to foreign key constraint
      await expect(roleQueries.deleteRole(testRole.id)).rejects.toThrow();

      // Verify role still exists
      const existingRole = await db.select().from(schema.roles).where(schema.eq(schema.roles.id, testRole.id)).limit(1);
      expect(existingRole).toHaveLength(1);
    });
  });

  // ==================== assignPermissionsToRole ====================
  describe('assignPermissionsToRole', () => {
    test('should assign single permission to role', async () => {
      const result = await roleQueries.assignPermissionsToRole(testRole.id, [testPermission.id]);

      expect(result).toBeDefined();
      expect(result.permissions).toHaveLength(1);
      expect(result.permissions[0].id).toBe(testPermission.id);

      // Verify in database
      const rolePermissions = await db
        .select()
        .from(schema.rolePermissions)
        .where(schema.eq(schema.rolePermissions.roleId, testRole.id));
      expect(rolePermissions).toHaveLength(1);
    });

    test('should assign multiple permissions to role', async () => {
      const permissions = await db.select().from(schema.permissions).limit(3);
      const permissionIds = permissions.map(p => p.id);

      const result = await roleQueries.assignPermissionsToRole(testRole.id, permissionIds);

      expect(result.permissions).toHaveLength(3);
      const assignedIds = result.permissions.map(p => p.id);
      permissionIds.forEach(id => {
        expect(assignedIds).toContain(id);
      });
    });

    test('should handle assigning to role that already has permissions', async () => {
      // Pre-assign one permission
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      const additionalPermission = await db
        .select()
        .from(schema.permissions)
        .where(schema.ne(schema.permissions.id, testPermission.id))
        .limit(1);

      const result = await roleQueries.assignPermissionsToRole(testRole.id, [additionalPermission[0].id]);

      expect(result.permissions).toHaveLength(2);
    });

    test('should return null for non-existent role', async () => {
      const result = await roleQueries.assignPermissionsToRole(99999, [testPermission.id]);
      expect(result).toBeNull();
    });

    test('should handle duplicate permission assignments', async () => {
      // Pre-assign permission
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      // Try to assign same permission again
      await expect(roleQueries.assignPermissionsToRole(testRole.id, [testPermission.id])).rejects.toThrow();
    });

    test('should handle non-existent permission IDs', async () => {
      await expect(roleQueries.assignPermissionsToRole(testRole.id, [99999])).rejects.toThrow();
    });
  });

  // ==================== removePermissionFromRole ====================
  describe('removePermissionFromRole', () => {
    beforeEach(async () => {
      // Pre-assign permission for removal tests
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });
    });

    test('should remove permission from role', async () => {
      const result = await roleQueries.removePermissionFromRole(testRole.id, testPermission.id);

      expect(result).toBeDefined();
      expect(result.permissions).toHaveLength(0);

      // Verify in database
      const rolePermissions = await db
        .select()
        .from(schema.rolePermissions)
        .where(schema.eq(schema.rolePermissions.roleId, testRole.id));
      expect(rolePermissions).toHaveLength(0);
    });

    test('should handle removing permission while keeping others', async () => {
      // Add another permission
      const anotherPermission = await db
        .select()
        .from(schema.permissions)
        .where(schema.ne(schema.permissions.id, testPermission.id))
        .limit(1);

      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: anotherPermission[0].id,
      });

      const result = await roleQueries.removePermissionFromRole(testRole.id, testPermission.id);

      expect(result.permissions).toHaveLength(1);
      expect(result.permissions[0].id).toBe(anotherPermission[0].id);
    });

    test('should return null for non-existent role', async () => {
      const result = await roleQueries.removePermissionFromRole(99999, testPermission.id);
      expect(result).toBeNull();
    });

    test('should return null for non-assigned permission', async () => {
      const anotherPermission = await TestDataFactory.createPermission({
        name: 'unassigned_permission',
      });

      const result = await roleQueries.removePermissionFromRole(testRole.id, anotherPermission.id);
      expect(result).toBeNull();
    });
  });

  // ==================== getRoleUsers ====================
  describe('getRoleUsers', () => {
    beforeEach(async () => {
      // Assign users to test role
      await db.update(schema.users).set({ roleId: testRole.id }).where(schema.eq(schema.users.id, regularUser.id));

      // Create additional users
      await TestDataFactory.createUser({
        name: 'Query Test User A',
        email: 'queryusera@example.com',
        roleId: testRole.id,
      });

      await TestDataFactory.createUser({
        name: 'Query Test User B',
        email: 'queryuserb@example.com',
        roleId: testRole.id,
      });
    });

    test('should get users assigned to role', async () => {
      const result = await roleQueries.getRoleUsers(testRole.id, {});

      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users.length).toBe(3);
      expect(result.totalUsers).toBe(3);
      expect(result.currentPage).toBe(1);

      // Verify user structure
      const user = result.users[0];
      expect(user.id).toBeDefined();
      expect(user.name).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.isVerified).toBeDefined();
      expect(user.createdAt).toBeDefined();
      expect(user.passwordHash).toBeUndefined(); // Should not include password
    });

    test('should support pagination for role users', async () => {
      const result = await roleQueries.getRoleUsers(testRole.id, {
        page: 1,
        limit: 2,
      });

      expect(result.users).toHaveLength(2);
      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBe(2);
    });

    test('should support search within role users', async () => {
      const result = await roleQueries.getRoleUsers(testRole.id, {
        search: 'Query Test User A',
      });

      expect(result.users.length).toBeGreaterThan(0);
      const foundUser = result.users.find(u => u.name === 'Query Test User A');
      expect(foundUser).toBeDefined();
    });

    test('should support sorting role users', async () => {
      const result = await roleQueries.getRoleUsers(testRole.id, {
        sortBy: 'name',
        order: 'asc',
      });

      if (result.users.length > 1) {
        for (let i = 1; i < result.users.length; i++) {
          expect(result.users[i - 1].name <= result.users[i].name).toBe(true);
        }
      }
    });

    test('should return null for non-existent role', async () => {
      const result = await roleQueries.getRoleUsers(99999, {});
      expect(result).toBeNull();
    });

    test('should return empty result for role with no users', async () => {
      const emptyRole = await TestDataFactory.createRole({
        name: 'empty_query_role',
        title: 'Empty Query Role',
      });

      const result = await roleQueries.getRoleUsers(emptyRole.id, {});

      expect(result.users).toHaveLength(0);
      expect(result.totalUsers).toBe(0);
    });
  });

  // ==================== getAllPermissions ====================
  describe('getAllPermissions', () => {
    test('should get all available permissions', async () => {
      const result = await roleQueries.getAllPermissions();

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
      expect(permissionNames).toContain('edit_content');
      expect(permissionNames).toContain('delete_content');
      expect(permissionNames).toContain('test_permission');
    });

    test('should return permissions in consistent order', async () => {
      const result1 = await roleQueries.getAllPermissions();
      const result2 = await roleQueries.getAllPermissions();

      expect(result1.length).toBe(result2.length);

      for (let i = 0; i < result1.length; i++) {
        expect(result1[i].id).toBe(result2[i].id);
        expect(result1[i].name).toBe(result2[i].name);
      }
    });
  });

  // ==================== Database Constraint Tests ====================
  describe('Database Constraints and Integrity', () => {
    test('should enforce unique role names', async () => {
      const roleData = {
        name: testRole.name,
        title: 'Duplicate Name Role',
      };

      await expect(roleQueries.createRole(roleData)).rejects.toThrow();
    });

    test('should enforce foreign key constraints on role deletion', async () => {
      // Assign user to role
      await db.update(schema.users).set({ roleId: testRole.id }).where(schema.eq(schema.users.id, regularUser.id));

      await expect(roleQueries.deleteRole(testRole.id)).rejects.toThrow();
    });

    test('should enforce foreign key constraints on role permissions', async () => {
      await expect(roleQueries.assignPermissionsToRole(testRole.id, [99999])).rejects.toThrow();
    });

    test('should enforce unique role permission assignments', async () => {
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      await expect(
        db.insert(schema.rolePermissions).values({
          roleId: testRole.id,
          permissionId: testPermission.id,
        })
      ).rejects.toThrow();
    });

    test('should handle null values correctly', async () => {
      const roleData = {
        name: 'null_test_role',
        title: 'Null Test Role',
        description: null,
        accessLevel: 'any' as const,
      };

      const result = await roleQueries.createRole(roleData);
      expect(result.description).toBeNull();

      // Update to null
      const updateResult = await roleQueries.updateRole(result.id, { description: null });
      expect(updateResult.description).toBeNull();
    });
  });

  // ==================== Performance and Edge Cases ====================
  describe('Performance and Edge Cases', () => {
    test('should handle large pagination requests', async () => {
      const result = await roleQueries.getAllRoles({ page: 1, limit: 100 });

      expect(result.roles.length).toBeLessThanOrEqual(100);
      expect(result.currentPage).toBe(1);
    });

    test('should handle empty search strings', async () => {
      const result = await roleQueries.getAllRoles({ search: '' });

      expect(result.roles.length).toBeGreaterThan(0); // Should return all roles
    });

    test('should handle whitespace-only search strings', async () => {
      const result = await roleQueries.getAllRoles({ search: '   ' });

      expect(result.roles.length).toBeGreaterThan(0); // Should return all roles
    });

    test('should handle special characters in search', async () => {
      const result = await roleQueries.getAllRoles({ search: '@#$%^&*()' });

      expect(result.roles).toHaveLength(0);
      expect(result.totalRoles).toBe(0);
    });

    test('should handle very long search strings', async () => {
      const longSearch = 'a'.repeat(1000);
      const result = await roleQueries.getAllRoles({ search: longSearch });

      expect(result.roles).toHaveLength(0);
    });

    test('should handle concurrent operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        roleQueries.createRole({
          name: `concurrent_role_${i}`,
          title: `Concurrent Role ${i}`,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.name).toBe(`concurrent_role_${i}`);
      });
    });
  });
});
