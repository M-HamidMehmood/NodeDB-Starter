import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app';
import { cleanDatabase, seedTestDatabase } from '../seeds/testSeeds';
import { TestDataFactory } from '../helpers/testHelpers';
import * as schema from '../../src/db/schema';
import { db } from '../../src/db/connection';
import { createJWT } from '../../src/utils/jwt';
import type { User, Role } from '../../src/db/schema';

interface TestUser extends User {
  role?: Role;
}

interface AuthTokens {
  adminUser: TestUser;
  adminToken: string;
  regularUser: TestUser;
  regularToken: string;
  moderatorUser: TestUser;
  moderatorToken: string;
}

describe('Role API - CRUD Operations', () => {
  let auth: AuthTokens;
  let testRole: Role;

  beforeEach(async () => {
    await cleanDatabase();
    await seedTestDatabase();

    // Get seeded users and create tokens with proper typing
    const [adminUserData] = await db
      .select()
      .from(schema.users)
      .where(schema.eq(schema.users.email, 'admin@example.com'))
      .limit(1);

    const [regularUserData] = await db
      .select()
      .from(schema.users)
      .where(schema.eq(schema.users.email, 'user@example.com'))
      .limit(1);

    const [moderatorUserData] = await db
      .select()
      .from(schema.users)
      .where(schema.eq(schema.users.email, 'moderator@example.com'))
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
      moderatorUser: moderatorUserData,
      moderatorToken: createJWT({
        userId: moderatorUserData.id,
        email: moderatorUserData.email,
        name: moderatorUserData.name,
        roleId: moderatorUserData.roleId,
        permissions: ['view_users', 'edit_content'],
      }),
    };

    // Create additional test role
    testRole = await TestDataFactory.createRole({
      name: 'test_role',
      title: 'Test Role',
      description: 'A role created for testing',
      accessLevel: 'organization',
    });
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  // ==================== GET /api/v1/role ====================
  describe('GET /api/v1/role - Get All Roles', () => {
    test('should get all roles with admin access', async () => {
      const response = await request(app).get('/api/v1/role').set('Cookie', `token=${auth.adminToken}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.roles).toBeDefined();
      expect(Array.isArray(response.body.data.roles)).toBe(true);
      expect(response.body.data.roles.length).toBeGreaterThanOrEqual(4); // 3 seeded + 1 test role
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.totalRoles).toBeGreaterThanOrEqual(4);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.hasNextPage).toBeDefined();
      expect(response.body.data.pagination.hasPrevPage).toBe(false);
    });

    test('should support pagination correctly', async () => {
      // Create additional roles for pagination testing
      await TestDataFactory.createRole({ name: 'role_1', title: 'Role 1' });
      await TestDataFactory.createRole({ name: 'role_2', title: 'Role 2' });
      await TestDataFactory.createRole({ name: 'role_3', title: 'Role 3' });

      const response = await request(app)
        .get('/api/v1/role?page=1&limit=3')
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.data.roles).toHaveLength(3);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalPages).toBeGreaterThanOrEqual(2);
      expect(response.body.data.pagination.hasNextPage).toBe(true);

      // Test second page
      const response2 = await request(app)
        .get('/api/v1/role?page=2&limit=3')
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response2.body.data.pagination.currentPage).toBe(2);
      expect(response2.body.data.pagination.hasPrevPage).toBe(true);
    });

    test('should support search functionality', async () => {
      const response = await request(app)
        .get('/api/v1/role?search=Admin')
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.data.roles.length).toBeGreaterThan(0);
      const foundRole = response.body.data.roles.find((r: Role) => r.title.includes('Admin'));
      expect(foundRole).toBeDefined();
      expect(foundRole.name).toBe('admin');
    });

    test('should support search by description', async () => {
      const response = await request(app)
        .get('/api/v1/role?search=testing')
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      const foundRole = response.body.data.roles.find((r: Role) => r.description?.includes('testing'));
      expect(foundRole).toBeDefined();
      expect(foundRole.name).toBe('test_role');
    });

    test('should support sorting by name ascending', async () => {
      const response = await request(app)
        .get('/api/v1/role?sortBy=name&order=asc')
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      const { roles } = response.body.data;
      for (let i = 1; i < roles.length; i++) {
        expect(roles[i - 1].name <= roles[i].name).toBe(true);
      }
    });

    test('should support sorting by title descending', async () => {
      const response = await request(app)
        .get('/api/v1/role?sortBy=title&order=desc')
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      const { roles } = response.body.data;
      for (let i = 1; i < roles.length; i++) {
        expect(roles[i - 1].title >= roles[i].title).toBe(true);
      }
    });

    test('should include stats when requested', async () => {
      const response = await request(app)
        .get('/api/v1/role?includeStats=true')
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      const roleWithStats = response.body.data.roles.find((r: any) => r.name === 'admin');
      expect(roleWithStats).toBeDefined();
      expect(roleWithStats.userCount).toBeDefined();
      expect(roleWithStats.permissionCount).toBeDefined();
      expect(roleWithStats.permissions).toBeDefined();
      expect(Array.isArray(roleWithStats.permissions)).toBe(true);
      expect(roleWithStats.userCount).toBe(1); // Only admin user
      expect(roleWithStats.permissionCount).toBe(4); // All permissions
    });

    test('should validate query parameters', async () => {
      // Invalid page
      await request(app).get('/api/v1/role?page=0').set('Cookie', `token=${auth.adminToken}`).expect(400);

      // Invalid limit
      await request(app).get('/api/v1/role?limit=101').set('Cookie', `token=${auth.adminToken}`).expect(400);

      // Invalid sortBy
      await request(app).get('/api/v1/role?sortBy=invalid_field').set('Cookie', `token=${auth.adminToken}`).expect(400);

      // Invalid order
      await request(app).get('/api/v1/role?order=invalid').set('Cookie', `token=${auth.adminToken}`).expect(400);
    });

    test('should deny access to regular users', async () => {
      await request(app).get('/api/v1/role').set('Cookie', `token=${auth.regularToken}`).expect(403);
    });

    test('should deny access to unauthenticated users', async () => {
      await request(app).get('/api/v1/role').expect(401);
    });

    test('should handle empty search results', async () => {
      const response = await request(app)
        .get('/api/v1/role?search=nonexistent_role_xyz')
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.data.roles).toHaveLength(0);
      expect(response.body.data.pagination.totalRoles).toBe(0);
      expect(response.body.data.pagination.totalPages).toBe(0);
    });
  });

  // ==================== GET /api/v1/role/:id ====================
  describe('GET /api/v1/role/:id - Get Single Role', () => {
    test('should get single role with permissions', async () => {
      const [adminRole] = await db.select().from(schema.roles).where(schema.eq(schema.roles.name, 'admin')).limit(1);

      const response = await request(app)
        .get(`/api/v1/role/${adminRole.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(adminRole.id);
      expect(response.body.data.name).toBe('admin');
      expect(response.body.data.title).toBe('Administrator');
      expect(response.body.data.permissions).toBeDefined();
      expect(Array.isArray(response.body.data.permissions)).toBe(true);
      expect(response.body.data.permissions.length).toBe(4);

      // Verify specific permissions
      const permissionNames = response.body.data.permissions.map((p: any) => p.name);
      expect(permissionNames).toContain('manage_users');
      expect(permissionNames).toContain('view_users');
      expect(permissionNames).toContain('edit_content');
      expect(permissionNames).toContain('delete_content');
    });

    test('should return role without permissions when none assigned', async () => {
      const response = await request(app)
        .get(`/api/v1/role/${testRole.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.data.id).toBe(testRole.id);
      expect(response.body.data.name).toBe('test_role');
      expect(response.body.data.permissions).toBeDefined();
      expect(response.body.data.permissions).toHaveLength(0);
    });

    test('should return 404 for non-existent role', async () => {
      await request(app).get('/api/v1/role/99999').set('Cookie', `token=${auth.adminToken}`).expect(404);
    });

    test('should validate role ID parameter', async () => {
      // Invalid ID format
      await request(app).get('/api/v1/role/invalid').set('Cookie', `token=${auth.adminToken}`).expect(400);

      // Negative ID
      await request(app).get('/api/v1/role/-1').set('Cookie', `token=${auth.adminToken}`).expect(400);

      // Zero ID
      await request(app).get('/api/v1/role/0').set('Cookie', `token=${auth.adminToken}`).expect(400);
    });

    test('should deny access to unauthorized users', async () => {
      await request(app).get(`/api/v1/role/${testRole.id}`).set('Cookie', `token=${auth.regularToken}`).expect(403);
    });
  });

  // ==================== POST /api/v1/role ====================
  describe('POST /api/v1/role - Create Role', () => {
    test('should create new role successfully with all fields', async () => {
      const roleData = {
        name: 'new_test_role',
        title: 'New Test Role',
        description: 'A newly created test role',
        accessLevel: 'organization',
      };

      const response = await request(app)
        .post('/api/v1/role')
        .set('Cookie', `token=${auth.adminToken}`)
        .send(roleData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(roleData.name);
      expect(response.body.data.title).toBe(roleData.title);
      expect(response.body.data.description).toBe(roleData.description);
      expect(response.body.data.accessLevel).toBe(roleData.accessLevel);
      expect(response.body.data.id).toBeDefined();

      // Verify in database
      const [createdRole] = await db
        .select()
        .from(schema.roles)
        .where(schema.eq(schema.roles.name, roleData.name))
        .limit(1);
      expect(createdRole).toBeDefined();
      expect(createdRole.title).toBe(roleData.title);
    });

    test('should create role with minimal required fields', async () => {
      const roleData = {
        name: 'minimal_role',
        title: 'Minimal Role',
      };

      const response = await request(app)
        .post('/api/v1/role')
        .set('Cookie', `token=${auth.adminToken}`)
        .send(roleData)
        .expect(201);

      expect(response.body.data.name).toBe(roleData.name);
      expect(response.body.data.title).toBe(roleData.title);
      expect(response.body.data.accessLevel).toBe('any'); // Default value
      expect(response.body.data.description).toBeNull();
    });

    test('should create role with null description', async () => {
      const roleData = {
        name: 'null_desc_role',
        title: 'Null Description Role',
        description: null,
        accessLevel: 'all',
      };

      const response = await request(app)
        .post('/api/v1/role')
        .set('Cookie', `token=${auth.adminToken}`)
        .send(roleData)
        .expect(201);

      expect(response.body.data.description).toBeNull();
    });

    test('should fail with duplicate role name', async () => {
      const roleData = {
        name: 'admin', // Existing role name
        title: 'Duplicate Admin Role',
      };

      const response = await request(app)
        .post('/api/v1/role')
        .set('Cookie', `token=${auth.adminToken}`)
        .send(roleData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    test('should validate required fields', async () => {
      // Missing name
      await request(app)
        .post('/api/v1/role')
        .set('Cookie', `token=${auth.adminToken}`)
        .send({ title: 'Test Role' })
        .expect(400);

      // Missing title
      await request(app)
        .post('/api/v1/role')
        .set('Cookie', `token=${auth.adminToken}`)
        .send({ name: 'test_role' })
        .expect(400);

      // Empty object
      await request(app).post('/api/v1/role').set('Cookie', `token=${auth.adminToken}`).send({}).expect(400);
    });

    test('should validate role name format', async () => {
      const invalidNames = [
        'Invalid Role Name', // Contains spaces
        'invalid-role-name', // Contains hyphens
        'InvalidRoleName', // Contains uppercase
        'invalid@role', // Contains special chars
        'role name with spaces', // Multiple spaces
        '123invalid', // Starts with number
        'a', // Too short
        'a'.repeat(51), // Too long
      ];

      for (const invalidName of invalidNames) {
        await request(app)
          .post('/api/v1/role')
          .set('Cookie', `token=${auth.adminToken}`)
          .send({
            name: invalidName,
            title: 'Test Role',
          })
          .expect(400);
      }
    });

    test('should validate title length constraints', async () => {
      // Title too short
      await request(app)
        .post('/api/v1/role')
        .set('Cookie', `token=${auth.adminToken}`)
        .send({
          name: 'test_role',
          title: 'A', // Only 1 character
        })
        .expect(400);

      // Title too long
      await request(app)
        .post('/api/v1/role')
        .set('Cookie', `token=${auth.adminToken}`)
        .send({
          name: 'test_role',
          title: 'A'.repeat(101), // 101 characters
        })
        .expect(400);
    });

    test('should validate description length', async () => {
      // Description too long
      await request(app)
        .post('/api/v1/role')
        .set('Cookie', `token=${auth.adminToken}`)
        .send({
          name: 'test_role',
          title: 'Test Role',
          description: 'A'.repeat(501), // 501 characters
        })
        .expect(400);
    });

    test('should validate access level enum', async () => {
      const invalidAccessLevels = ['invalid_level', 'admin_level', 'super_user', ''];

      for (const invalidLevel of invalidAccessLevels) {
        await request(app)
          .post('/api/v1/role')
          .set('Cookie', `token=${auth.adminToken}`)
          .send({
            name: 'test_role',
            title: 'Test Role',
            accessLevel: invalidLevel,
          })
          .expect(400);
      }
    });

    test('should accept valid access levels', async () => {
      const validAccessLevels = ['any', 'organization', 'all'];

      for (let i = 0; i < validAccessLevels.length; i++) {
        const level = validAccessLevels[i];
        await request(app)
          .post('/api/v1/role')
          .set('Cookie', `token=${auth.adminToken}`)
          .send({
            name: `test_role_${i}`,
            title: `Test Role ${i}`,
            accessLevel: level,
          })
          .expect(201);
      }
    });

    test('should deny access to unauthorized users', async () => {
      const roleData = {
        name: 'unauthorized_role',
        title: 'Unauthorized Role',
      };

      await request(app).post('/api/v1/role').set('Cookie', `token=${auth.regularToken}`).send(roleData).expect(403);

      await request(app).post('/api/v1/role').send(roleData).expect(401);
    });
  });

  // ==================== PUT /api/v1/role/:id ====================
  describe('PUT /api/v1/role/:id - Update Role', () => {
    test('should update role successfully with all fields', async () => {
      const updateData = {
        title: 'Updated Test Role',
        description: 'Updated description for the test role',
        accessLevel: 'all',
      };

      const response = await request(app)
        .put(`/api/v1/role/${testRole.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.accessLevel).toBe(updateData.accessLevel);
      expect(response.body.data.name).toBe(testRole.name); // Should remain unchanged

      // Verify in database
      const [updatedRole] = await db
        .select()
        .from(schema.roles)
        .where(schema.eq(schema.roles.id, testRole.id))
        .limit(1);
      expect(updatedRole.title).toBe(updateData.title);
      expect(updatedRole.description).toBe(updateData.description);
    });

    test('should update role with partial data', async () => {
      const updateData = {
        title: 'Partially Updated Role',
      };

      const response = await request(app)
        .put(`/api/v1/role/${testRole.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.name).toBe(testRole.name); // Unchanged
      expect(response.body.data.description).toBe(testRole.description); // Unchanged
      expect(response.body.data.accessLevel).toBe(testRole.accessLevel); // Unchanged
    });

    test('should update role name for non-protected roles', async () => {
      const updateData = {
        name: 'updated_test_role_name',
      };

      const response = await request(app)
        .put(`/api/v1/role/${testRole.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.name).toBe(updateData.name);
    });

    test('should prevent updating protected role name', async () => {
      const [adminRole] = await db.select().from(schema.roles).where(schema.eq(schema.roles.name, 'admin')).limit(1);

      const updateData = {
        name: 'new_admin_name',
      };

      await request(app)
        .put(`/api/v1/role/${adminRole.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send(updateData)
        .expect(400);
    });

    test('should prevent updating protected role access level', async () => {
      const [userRole] = await db.select().from(schema.roles).where(schema.eq(schema.roles.name, 'user')).limit(1);

      const updateData = {
        accessLevel: 'all',
      };

      await request(app)
        .put(`/api/v1/role/${userRole.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send(updateData)
        .expect(400);
    });

    test('should allow updating protected role title and description', async () => {
      const [adminRole] = await db.select().from(schema.roles).where(schema.eq(schema.roles.name, 'admin')).limit(1);

      const updateData = {
        title: 'Super Administrator',
        description: 'Updated description for admin role',
      };

      const response = await request(app)
        .put(`/api/v1/role/${adminRole.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.name).toBe('admin'); // Should remain unchanged
    });

    test('should prevent duplicate role names', async () => {
      const updateData = {
        name: 'admin', // Trying to use existing name
      };

      await request(app)
        .put(`/api/v1/role/${testRole.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send(updateData)
        .expect(400);
    });

    test('should validate update fields with same rules as create', async () => {
      // Invalid name format
      await request(app)
        .put(`/api/v1/role/${testRole.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send({ name: 'Invalid Name' })
        .expect(400);

      // Invalid title length
      await request(app)
        .put(`/api/v1/role/${testRole.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send({ title: 'A' })
        .expect(400);

      // Invalid access level
      await request(app)
        .put(`/api/v1/role/${testRole.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send({ accessLevel: 'invalid' })
        .expect(400);
    });

    test('should return 404 for non-existent role', async () => {
      await request(app)
        .put('/api/v1/role/99999')
        .set('Cookie', `token=${auth.adminToken}`)
        .send({ title: 'Updated Title' })
        .expect(404);
    });

    test('should handle empty update data', async () => {
      const response = await request(app)
        .put(`/api/v1/role/${testRole.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .send({})
        .expect(200);

      // Should return the role unchanged
      expect(response.body.data.name).toBe(testRole.name);
      expect(response.body.data.title).toBe(testRole.title);
    });

    test('should deny access to unauthorized users', async () => {
      await request(app)
        .put(`/api/v1/role/${testRole.id}`)
        .set('Cookie', `token=${auth.regularToken}`)
        .send({ title: 'Unauthorized Update' })
        .expect(403);
    });
  });

  // ==================== DELETE /api/v1/role/:id ====================
  describe('DELETE /api/v1/role/:id - Delete Role', () => {
    test('should delete role successfully when no users assigned', async () => {
      const response = await request(app)
        .delete(`/api/v1/role/${testRole.id}`)
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify role is deleted from database
      const deletedRole = await db.select().from(schema.roles).where(schema.eq(schema.roles.id, testRole.id)).limit(1);
      expect(deletedRole).toHaveLength(0);
    });

    test('should prevent deleting protected roles', async () => {
      const [adminRole] = await db.select().from(schema.roles).where(schema.eq(schema.roles.name, 'admin')).limit(1);

      await request(app).delete(`/api/v1/role/${adminRole.id}`).set('Cookie', `token=${auth.adminToken}`).expect(400);

      const [userRole] = await db.select().from(schema.roles).where(schema.eq(schema.roles.name, 'user')).limit(1);

      await request(app).delete(`/api/v1/role/${userRole.id}`).set('Cookie', `token=${auth.adminToken}`).expect(400);
    });

    test('should prevent deleting role with assigned users', async () => {
      // Assign regular user to test role
      await db.update(schema.users).set({ roleId: testRole.id }).where(schema.eq(schema.users.id, auth.regularUser.id));

      await request(app).delete(`/api/v1/role/${testRole.id}`).set('Cookie', `token=${auth.adminToken}`).expect(400);

      // Verify role still exists
      const existingRole = await db.select().from(schema.roles).where(schema.eq(schema.roles.id, testRole.id)).limit(1);
      expect(existingRole).toHaveLength(1);
    });

    test('should delete role and cascade remove permissions', async () => {
      // Assign permissions to test role
      const [permission] = await db
        .select()
        .from(schema.permissions)
        .where(schema.eq(schema.permissions.name, 'view_users'))
        .limit(1);

      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: permission.id,
      });

      await request(app).delete(`/api/v1/role/${testRole.id}`).set('Cookie', `token=${auth.adminToken}`).expect(200);

      // Verify role permissions are also deleted
      const remainingPermissions = await db
        .select()
        .from(schema.rolePermissions)
        .where(schema.eq(schema.rolePermissions.roleId, testRole.id));
      expect(remainingPermissions).toHaveLength(0);
    });

    test('should return 404 for non-existent role', async () => {
      await request(app).delete('/api/v1/role/99999').set('Cookie', `token=${auth.adminToken}`).expect(404);
    });

    test('should validate role ID parameter', async () => {
      await request(app).delete('/api/v1/role/invalid').set('Cookie', `token=${auth.adminToken}`).expect(400);
    });

    test('should deny access to unauthorized users', async () => {
      await request(app).delete(`/api/v1/role/${testRole.id}`).set('Cookie', `token=${auth.regularToken}`).expect(403);

      await request(app).delete(`/api/v1/role/${testRole.id}`).expect(401);
    });
  });

  // ==================== GET /api/v1/role/permissions ====================
  describe('GET /api/v1/role/permissions - Get All Permissions', () => {
    test('should get all available permissions', async () => {
      const response = await request(app)
        .get('/api/v1/role/permissions')
        .set('Cookie', `token=${auth.adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(4); // 4 seeded permissions

      // Verify specific permissions exist
      const permissionNames = response.body.data.map((p: any) => p.name);
      expect(permissionNames).toContain('manage_users');
      expect(permissionNames).toContain('view_users');
      expect(permissionNames).toContain('edit_content');
      expect(permissionNames).toContain('delete_content');

      // Verify permission structure
      const permission = response.body.data[0];
      expect(permission.id).toBeDefined();
      expect(permission.name).toBeDefined();
      expect(permission.description).toBeDefined();
    });

    test('should deny access to unauthorized users', async () => {
      await request(app).get('/api/v1/role/permissions').set('Cookie', `token=${auth.regularToken}`).expect(403);

      await request(app).get('/api/v1/role/permissions').expect(401);
    });
  });
});
