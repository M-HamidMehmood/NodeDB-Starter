import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { eq, and } from 'drizzle-orm';
import app from '../../src/app';
import { cleanDatabase, seedTestDatabase } from '../seeds/testSeeds';
import { TestDataFactory } from '../helpers/testHelpers';
import * as schema from '../../src/db/schema';
import { db } from '../../src/db/connection';
import { createJWT } from '../../src/utils/jwt';
import type { User, Role, Permission } from '../../src/db/schema';

interface TestUser extends User {
  role?: Role;
}

interface AuthTokens {
  adminUser: TestUser;
  adminToken: string;
  regularUser: TestUser;
  regularToken: string;
}

describe('Role API - Permission & User Management', () => {
  let auth: AuthTokens;
  let testRole: Role;
  let testPermission: Permission;

  beforeEach(async () => {
    await cleanDatabase();
    await seedTestDatabase();

    // Get seeded users and create tokens with proper typing
    const [adminUserData] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'admin@example.com'))
      .limit(1);

    const [regularUserData] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'user@example.com'))
      .limit(1);

    auth = {
      adminUser: adminUserData,
      adminToken: createJWT({
        userId: adminUserData.id,
        email: adminUserData.email,
        name: adminUserData.name,
        roleId: adminUserData.roleId,
        permissions: ['manage_users', 'view_users', 'edit_content', 'delete_content'],
      }),
      regularUser: regularUserData,
      regularToken: createJWT({
        userId: regularUserData.id,
        email: regularUserData.email,
        name: regularUserData.name,
        roleId: regularUserData.roleId,
        permissions: [],
      }),
    };

    // Create test role and permission
    testRole = await TestDataFactory.createRole({
      name: 'test_role',
      title: 'Test Role',
      description: 'A role created for testing',
      accessLevel: 'organization',
    });

    testPermission = await TestDataFactory.createPermission({
      name: 'test_permission',
      description: 'A permission created for testing',
    });
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  // ==================== POST /api/v1/role/:id/permissions ====================
  describe('POST /api/v1/role/:id/permissions - Assign Permissions', () => {
    test('should assign single permission to role', async () => {
      const permissionData = {
        permissionIds: [testPermission.id],
      };

      const response = await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send(permissionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.permissions).toBeDefined();
      expect(Array.isArray(response.body.data.permissions)).toBe(true);
      expect(response.body.data.permissions).toHaveLength(1);
      expect(response.body.data.permissions[0].id).toBe(testPermission.id);
      expect(response.body.data.permissions[0].name).toBe(testPermission.name);

      // Verify in database
      const rolePermissions = await db
        .select()
        .from(schema.rolePermissions)
        .where(eq(schema.rolePermissions.roleId, testRole.id));
      expect(rolePermissions).toHaveLength(1);
      expect(rolePermissions[0].permissionId).toBe(testPermission.id);
    });

    test('should assign multiple permissions to role', async () => {
      const [viewPermission] = await db
        .select()
        .from(schema.permissions)
        .where(eq(schema.permissions.name, 'view_users'))
        .limit(1);
      const [editPermission] = await db
        .select()
        .from(schema.permissions)
        .where(eq(schema.permissions.name, 'edit_content'))
        .limit(1);

      const permissionData = {
        permissionIds: [testPermission.id, viewPermission.id, editPermission.id],
      };

      const response = await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send(permissionData)
        .expect(200);

      expect(response.body.data.permissions).toHaveLength(3);

      const assignedPermissionIds = response.body.data.permissions.map((p: Permission) => p.id);
      expect(assignedPermissionIds).toContain(testPermission.id);
      expect(assignedPermissionIds).toContain(viewPermission.id);
      expect(assignedPermissionIds).toContain(editPermission.id);
    });

    test('should handle assignment to role that already has permissions', async () => {
      // First assign one permission
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      // Now assign additional permissions
      const [viewPermission] = await db
        .select()
        .from(schema.permissions)
        .where(eq(schema.permissions.name, 'view_users'))
        .limit(1);

      const permissionData = {
        permissionIds: [viewPermission.id],
      };

      const response = await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send(permissionData)
        .expect(200);

      expect(response.body.data.permissions).toHaveLength(2);
    });

    test('should return 404 for non-existent role', async () => {
      const permissionData = {
        permissionIds: [testPermission.id],
      };

      await request(app)
        .post('/api/v1/role/99999/permissions')
        .set('Cookie', `token=${auth.adminToken}`)
        .send(permissionData)
        .expect(404);
    });

    test('should return 400 for non-existent permissions', async () => {
      const permissionData = {
        permissionIds: [99999, 99998],
      };

      await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send(permissionData)
        .expect(400);
    });

    test('should prevent duplicate permission assignments', async () => {
      // Pre-assign permission
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      const permissionData = {
        permissionIds: [testPermission.id],
      };

      await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send(permissionData)
        .expect(400);
    });

    test('should validate permission IDs', async () => {
      // Empty array
      await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send({ permissionIds: [] })
        .expect(400);

      // Invalid ID types
      await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send({ permissionIds: ['invalid', 'ids'] })
        .expect(400);

      // Negative IDs
      await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send({ permissionIds: [-1, 0] })
        .expect(400);

      // Too many permissions
      const tooManyIds = Array.from({ length: 51 }, (_, i) => i + 1);
      await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send({ permissionIds: tooManyIds })
        .expect(400);
    });

    test('should validate request body structure', async () => {
      // Missing permissionIds field
      await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send({})
        .expect(400);

      // Wrong field name
      await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send({ permissions: [1, 2] })
        .expect(400);
    });

    test('should deny access to unauthorized users', async () => {
      const permissionData = {
        permissionIds: [testPermission.id],
      };

      await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${auth.regularToken}`)
        .send(permissionData)
        .expect(403);

      await request(app).post(`/api/v1/role/${testRole.id}/permissions`).send(permissionData).expect(401);
    });
  });

  // ==================== DELETE /api/v1/role/:id/permissions/:permissionId ====================
  describe('DELETE /api/v1/role/:id/permissions/:permissionId - Remove Permission', () => {
    beforeEach(async () => {
      // Assign permission to role for removal tests
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });
    });

    test('should remove permission from role successfully', async () => {
      const response = await request(app)
        .delete(`/api/v1/role/${testRole.id}/permissions/${testPermission.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.permissions).toBeDefined();
      expect(response.body.data.permissions.some((p: Permission) => p.id === testPermission.id)).toBe(false);

      // Verify in database
      const rolePermissions = await db
        .select()
        .from(schema.rolePermissions)
        .where(
          schema.and(
            eq(schema.rolePermissions.roleId, testRole.id),
            eq(schema.rolePermissions.permissionId, testPermission.id)
          )
        );
      expect(rolePermissions).toHaveLength(0);
    });

    test('should handle removing permission while keeping others', async () => {
      // Add another permission
      const [viewPermission] = await db
        .select()
        .from(schema.permissions)
        .where(eq(schema.permissions.name, 'view_users'))
        .limit(1);

      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: viewPermission.id,
      });

      const response = await request(app)
        .delete(`/api/v1/role/${testRole.id}/permissions/${testPermission.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.data.permissions).toHaveLength(1);
      expect(response.body.data.permissions[0].id).toBe(viewPermission.id);
    });

    test('should return 404 for non-existent role', async () => {
      await request(app)
        .delete(`/api/v1/role/99999/permissions/${testPermission.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(404);
    });

    test('should return 404 for non-assigned permission', async () => {
      const anotherPermission = await TestDataFactory.createPermission({
        name: 'another_permission',
      });

      await request(app)
        .delete(`/api/v1/role/${testRole.id}/permissions/${anotherPermission.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(404);
    });

    test('should validate role and permission IDs', async () => {
      // Invalid role ID
      await request(app)
        .delete(`/api/v1/role/invalid/permissions/${testPermission.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(400);

      // Invalid permission ID
      await request(app)
        .delete(`/api/v1/role/${testRole.id}/permissions/invalid`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(400);

      // Negative IDs
      await request(app)
        .delete(`/api/v1/role/-1/permissions/${testPermission.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(400);

      await request(app)
        .delete(`/api/v1/role/${testRole.id}/permissions/-1`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(400);
    });

    test('should deny access to unauthorized users', async () => {
      await request(app)
        .delete(`/api/v1/role/${testRole.id}/permissions/${testPermission.id}`)
        .set('Cookie', `token=${auth.regularToken}`)
        .expect(403);

      await request(app).delete(`/api/v1/role/${testRole.id}/permissions/${testPermission.id}`).expect(401);
    });
  });

  // ==================== GET /api/v1/role/:id/users ====================
  describe('GET /api/v1/role/:id/users - Get Role Users', () => {
    beforeEach(async () => {
      // Assign some users to test role
      await db.update(schema.users).set({ roleId: testRole.id }).where(eq(schema.users.id, auth.regularUser.id));

      // Create additional users for the role
      await TestDataFactory.createUser({
        name: 'Test User A',
        email: 'usera@example.com',
        roleId: testRole.id,
      });

      await TestDataFactory.createUser({
        name: 'Test User B',
        email: 'userb@example.com',
        roleId: testRole.id,
      });
    });

    test('should get users assigned to role', async () => {
      const response = await request(app)
        .get(`/api/v1/role/${testRole.id}/users`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toBeDefined();
      expect(Array.isArray(response.body.data.users)).toBe(true);
      expect(response.body.data.users.length).toBe(3); // regularUser + 2 test users
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.totalUsers).toBe(3);

      // Verify user data structure
      const user: User = response.body.data.users[0];
      expect(user.id).toBeDefined();
      expect(user.name).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.isVerified).toBeDefined();
      expect(user.createdAt).toBeDefined();
      expect((user as any).passwordHash).toBeUndefined(); // Should not expose password
    });

    test('should support pagination for role users', async () => {
      const response = await request(app)
        .get(`/api/v1/role/${testRole.id}/users?page=1&limit=2`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.data.users).toHaveLength(2);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalPages).toBe(2);
      expect(response.body.data.pagination.hasNextPage).toBe(true);
      expect(response.body.data.pagination.hasPrevPage).toBe(false);

      // Test second page
      const response2 = await request(app)
        .get(`/api/v1/role/${testRole.id}/users?page=2&limit=2`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response2.body.data.users).toHaveLength(1);
      expect(response2.body.data.pagination.currentPage).toBe(2);
      expect(response2.body.data.pagination.hasPrevPage).toBe(true);
      expect(response2.body.data.pagination.hasNextPage).toBe(false);
    });

    test('should support user search within role', async () => {
      const response = await request(app)
        .get(`/api/v1/role/${testRole.id}/users?search=Test User A`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.data.users.length).toBeGreaterThan(0);
      const foundUser = response.body.data.users.find((u: User) => u.name === 'Test User A');
      expect(foundUser).toBeDefined();
    });

    test('should support email search within role', async () => {
      const response = await request(app)
        .get(`/api/v1/role/${testRole.id}/users?search=usera@example.com`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.data.users.length).toBeGreaterThan(0);
      const foundUser = response.body.data.users.find((u: User) => u.email === 'usera@example.com');
      expect(foundUser).toBeDefined();
    });

    test('should support sorting role users', async () => {
      // Sort by name ascending
      const response = await request(app)
        .get(`/api/v1/role/${testRole.id}/users?sortBy=name&order=asc`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      const { users } = response.body.data;
      for (let i = 1; i < users.length; i++) {
        expect(users[i - 1].name <= users[i].name).toBe(true);
      }

      // Sort by email descending
      const response2 = await request(app)
        .get(`/api/v1/role/${testRole.id}/users?sortBy=email&order=desc`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      const users2: User[] = response2.body.data.users;
      for (let i = 1; i < users2.length; i++) {
        expect(users2[i - 1].email >= users2[i].email).toBe(true);
      }
    });

    test('should return empty result for role with no users', async () => {
      const emptyRole = await TestDataFactory.createRole({
        name: 'empty_role',
        title: 'Empty Role',
      });

      const response = await request(app)
        .get(`/api/v1/role/${emptyRole.id}/users`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.data.users).toHaveLength(0);
      expect(response.body.data.pagination.totalUsers).toBe(0);
      expect(response.body.data.pagination.totalPages).toBe(0);
    });

    test('should validate query parameters', async () => {
      // Invalid page
      await request(app)
        .get(`/api/v1/role/${testRole.id}/users?page=0`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(400);

      // Invalid limit
      await request(app)
        .get(`/api/v1/role/${testRole.id}/users?limit=101`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(400);

      // Invalid sortBy
      await request(app)
        .get(`/api/v1/role/${testRole.id}/users?sortBy=invalid_field`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(400);
    });

    test('should return 404 for non-existent role', async () => {
      await request(app).get('/api/v1/role/99999/users').set('Cookie', `token=${auth.adminToken}`).expect(404);
    });

    test('should deny access to unauthorized users', async () => {
      await request(app)
        .get(`/api/v1/role/${testRole.id}/users`)
        .set('Cookie', `token=${auth.regularToken}`)
        .expect(403);
    });
  });

  // ==================== GET /api/v1/role/:id/stats ====================
  describe('GET /api/v1/role/:id/stats - Get Role Statistics', () => {
    beforeEach(async () => {
      // Assign users and permissions to role for stats
      await db.update(schema.users).set({ roleId: testRole.id }).where(eq(schema.users.id, auth.regularUser.id));

      await TestDataFactory.createUser({
        name: 'Stats Test User',
        email: 'stats@example.com',
        roleId: testRole.id,
      });

      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      const [viewPermission] = await db
        .select()
        .from(schema.permissions)
        .where(eq(schema.permissions.name, 'view_users'))
        .limit(1);

      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: viewPermission.id,
      });
    });

    test('should get comprehensive role statistics', async () => {
      const response = await request(app)
        .get(`/api/v1/role/${testRole.id}/stats`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.roleId).toBe(testRole.id);
      expect(response.body.data.roleName).toBe(testRole.name);
      expect(response.body.data.userCount).toBe(2); // regularUser + stats test user
      expect(response.body.data.permissionCount).toBe(2); // testPermission + view_users
      expect(Array.isArray(response.body.data.permissions)).toBe(true);
      expect(response.body.data.permissions).toContain(testPermission.name);
      expect(response.body.data.permissions).toContain('view_users');
    });

    test('should show zero stats for role with no users or permissions', async () => {
      const emptyRole = await TestDataFactory.createRole({
        name: 'empty_stats_role',
        title: 'Empty Stats Role',
      });

      const response = await request(app)
        .get(`/api/v1/role/${emptyRole.id}/stats`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.data.roleId).toBe(emptyRole.id);
      expect(response.body.data.roleName).toBe('empty_stats_role');
      expect(response.body.data.userCount).toBe(0);
      expect(response.body.data.permissionCount).toBe(0);
      expect(response.body.data.permissions).toHaveLength(0);
    });

    test('should return 404 for non-existent role', async () => {
      await request(app).get('/api/v1/role/99999/stats').set('Cookie', `token=${auth.adminToken}`).expect(404);
    });

    test('should validate role ID parameter', async () => {
      await request(app).get('/api/v1/role/invalid/stats').set('Cookie', `token=${auth.adminToken}`).expect(400);
    });

    test('should deny access to unauthorized users', async () => {
      await request(app)
        .get(`/api/v1/role/${testRole.id}/stats`)
        .set('Cookie', `token=${auth.regularToken}`)
        .expect(403);
    });
  });

  // ==================== Error Handling & Edge Cases ====================
  describe('Error Handling & Edge Cases', () => {
    test('should handle malformed JSON in request body', async () => {
      await request(app)
        .post('/api/v1/role')
        .set('Cookie', `token=${auth.adminToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    test('should handle missing Content-Type header', async () => {
      await request(app)
        .post('/api/v1/role')
        .set('Cookie', `token=${auth.adminToken}`)
        .send('name=test_role&title=Test Role')
        .expect(400);
    });

    test('should handle invalid JWT tokens', async () => {
      await request(app).get('/api/v1/role').set('Cookie', 'token=invalid_jwt_token').expect(401);
    });

    test('should handle expired JWT tokens', async () => {
      const expiredToken = createJWT(
        {
          userId: auth.adminUser.id,
          email: auth.adminUser.email,
          name: auth.adminUser.name,
          roleId: auth.adminUser.roleId,
          permissions: ['manage_users'],
        },
        '0s' // Expired immediately
      );

      await request(app).get('/api/v1/role').set('Cookie', `token=${expiredToken}`).expect(401);
    });

    test('should handle very large request bodies', async () => {
      const largeDescription = 'A'.repeat(1000000); // 1MB description

      await request(app)
        .post('/api/v1/role')
        .set('Cookie', `token=${auth.adminToken}`)
        .send({
          name: 'large_role',
          title: 'Large Role',
          description: largeDescription,
        })
        .expect(400); // Should be rejected due to size limits
    });

    test('should handle concurrent permission assignments', async () => {
      const permissionData = {
        permissionIds: [testPermission.id],
      };

      // Try to assign the same permission concurrently
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .post(`/api/v1/role/${testRole.id}/permissions`)
          .set('Cookie', `token=${auth.adminToken}`)
          .send(permissionData)
      );

      const results = await Promise.allSettled(promises);

      // Only one should succeed, others should fail with 400
      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).status === 200);
      const failed = results.filter(r => r.status === 'fulfilled' && (r.value as any).status === 400);

      expect(successful.length).toBe(1);
      expect(failed.length).toBe(4);
    });

    test('should handle role deletion with circular dependencies', async () => {
      // This tests edge case where role relationships might create cycles
      // In our current schema this shouldn't happen, but good to test

      const roleA = await TestDataFactory.createRole({
        name: 'role_a',
        title: 'Role A',
      });

      const roleB = await TestDataFactory.createRole({
        name: 'role_b',
        title: 'Role B',
      });

      // Create some complex permission assignments
      const [permission1] = await db
        .select()
        .from(schema.permissions)
        .where(eq(schema.permissions.name, 'view_users'))
        .limit(1);

      await db.insert(schema.rolePermissions).values([
        { roleId: roleA.id, permissionId: permission1.id },
        { roleId: roleB.id, permissionId: permission1.id },
      ]);

      // Both roles should be deletable
      await request(app).delete(`/api/v1/role/${roleA.id}`).set('Cookie', `token=${auth.adminToken}`).expect(200);

      await request(app).delete(`/api/v1/role/${roleB.id}`).set('Cookie', `token=${auth.adminToken}`).expect(200);
    });

    test('should handle special characters in search queries', async () => {
      const specialChars = ['%', '_', '\\', "'", '"', ';', '--', '/*', '*/'];

      for (const char of specialChars) {
        const response = await request(app)
          .get(`/api/v1/role?search=${encodeURIComponent(char)}`)
          .set('Cookie', `token=${auth.adminToken}`)
          .expect(200);

        // Should not crash and return empty results
        expect(response.body.data.roles).toHaveLength(0);
      }
    });

    test('should handle unicode characters in role data', async () => {
      const unicodeRoleData = {
        name: 'unicode_role',
        title: 'Unicode Role 🚀 测试',
        description: 'Description with émojis 🎉 and ünicöde çharåcters',
      };

      const response = await request(app)
        .post('/api/v1/role')
        .set('Cookie', `token=${auth.adminToken}`)
        .send(unicodeRoleData)
        .expect(201);

      expect(response.body.data.title).toBe(unicodeRoleData.title);
      expect(response.body.data.description).toBe(unicodeRoleData.description);
    });

    test('should handle network timeout scenarios gracefully', async () => {
      // This would typically require mocking network delays
      // For now, test with very large operations that might timeout

      const manyPermissions = Array.from({ length: 50 }, (_, i) => testPermission.id);

      await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send({ permissionIds: manyPermissions })
        .expect(400); // Should fail validation before timeout
    });
  });
});
