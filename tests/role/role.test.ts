import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app';
import { cleanDatabase } from '../setup';
import { TestDataFactory } from '../helpers/testHelpers';
import * as schema from '../../src/db/schema';
import { db } from '../../src/db/connection';

describe('Role API', () => {
  let adminUser: any;
  let adminToken: string;
  let regularUser: any;
  let regularToken: string;
  let testRole: any;
  let testPermission: any;

  beforeEach(async () => {
    await cleanDatabase();

    // Create test permissions
    testPermission = await TestDataFactory.createPermission({
      name: 'test_permission',
      description: 'Test permission for role tests',
    });

    // Create admin user with manage_users permission
    const adminRole = await TestDataFactory.createRole({
      name: 'admin',
      title: 'Administrator',
      accessLevel: 'all',
    });

    const manageUsersPermission = await TestDataFactory.createPermission({
      name: 'manage_users',
      description: 'Permission to manage users and roles',
    });

    // Assign permission to admin role
    await db.insert(schema.rolePermissions).values({
      roleId: adminRole.id,
      permissionId: manageUsersPermission.id,
    });

    adminUser = await TestDataFactory.createUserWithRole('admin', ['manage_users']);
    adminToken = adminUser.token;

    // Create regular user
    regularUser = await TestDataFactory.createUser();
    regularToken = TestDataFactory.generateToken(regularUser);

    // Create test role
    testRole = await TestDataFactory.createRole({
      name: 'test_role',
      title: 'Test Role',
      description: 'A role for testing',
    });
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  describe('GET /api/v1/role', () => {
    test('should get all roles with admin access', async () => {
      const response = await request(app).get('/api/v1/role').set('Cookie', `token=${adminToken}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.roles).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
      expect(Array.isArray(response.body.data.roles)).toBe(true);
    });

    test('should support pagination parameters', async () => {
      // Create multiple roles
      await TestDataFactory.createRole({ name: 'role_1', title: 'Role 1' });
      await TestDataFactory.createRole({ name: 'role_2', title: 'Role 2' });
      await TestDataFactory.createRole({ name: 'role_3', title: 'Role 3' });

      const response = await request(app)
        .get('/api/v1/role?page=1&limit=2')
        .set('Cookie', `token=${adminToken}`)
        .expect(200);

      expect(response.body.data.roles).toHaveLength(2);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalPages).toBeGreaterThanOrEqual(1);
    });

    test('should support search functionality', async () => {
      await TestDataFactory.createRole({
        name: 'searchable_role',
        title: 'Searchable Role',
        description: 'This role can be found by search',
      });

      const response = await request(app)
        .get('/api/v1/role?search=searchable')
        .set('Cookie', `token=${adminToken}`)
        .expect(200);

      expect(response.body.data.roles.length).toBeGreaterThan(0);
      const foundRole = response.body.data.roles.find((r: any) => r.name === 'searchable_role');
      expect(foundRole).toBeDefined();
    });

    test('should support sorting', async () => {
      await TestDataFactory.createRole({ name: 'a_role', title: 'A Role' });
      await TestDataFactory.createRole({ name: 'z_role', title: 'Z Role' });

      const response = await request(app)
        .get('/api/v1/role?sortBy=name&order=asc')
        .set('Cookie', `token=${adminToken}`)
        .expect(200);

      const { roles } = response.body.data;
      expect(roles[0].name < roles[roles.length - 1].name).toBe(true);
    });

    test('should include stats when requested', async () => {
      const response = await request(app)
        .get('/api/v1/role?includeStats=true')
        .set('Cookie', `token=${adminToken}`)
        .expect(200);

      const rolesWithStats = response.body.data.roles;
      if (rolesWithStats.length > 0) {
        expect(rolesWithStats[0].userCount).toBeDefined();
        expect(rolesWithStats[0].permissionCount).toBeDefined();
        expect(rolesWithStats[0].permissions).toBeDefined();
      }
    });

    test('should deny access to regular users', async () => {
      await request(app).get('/api/v1/role').set('Cookie', `token=${regularToken}`).expect(403);
    });

    test('should deny access to unauthenticated users', async () => {
      await request(app).get('/api/v1/role').expect(401);
    });
  });

  describe('GET /api/v1/role/:id', () => {
    test('should get single role with permissions', async () => {
      // Assign permission to test role
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      const response = await request(app)
        .get(`/api/v1/role/${testRole.id}`)
        .set('Cookie', `token=${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testRole.id);
      expect(response.body.data.name).toBe(testRole.name);
      expect(response.body.data.permissions).toBeDefined();
      expect(Array.isArray(response.body.data.permissions)).toBe(true);
    });

    test('should return 404 for non-existent role', async () => {
      await request(app).get('/api/v1/role/99999').set('Cookie', `token=${adminToken}`).expect(404);
    });

    test('should validate role ID parameter', async () => {
      await request(app).get('/api/v1/role/invalid').set('Cookie', `token=${adminToken}`).expect(400);
    });
  });

  describe('POST /api/v1/role', () => {
    test('should create new role successfully', async () => {
      const roleData = {
        name: 'new_test_role',
        title: 'New Test Role',
        description: 'A newly created test role',
        accessLevel: 'organization',
      };

      const response = await request(app)
        .post('/api/v1/role')
        .set('Cookie', `token=${adminToken}`)
        .send(roleData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(roleData.name);
      expect(response.body.data.title).toBe(roleData.title);
      expect(response.body.data.description).toBe(roleData.description);
      expect(response.body.data.accessLevel).toBe(roleData.accessLevel);
    });

    test('should fail with duplicate role name', async () => {
      const roleData = {
        name: testRole.name, // Using existing role name
        title: 'Duplicate Role',
        description: 'This should fail',
      };

      await request(app).post('/api/v1/role').set('Cookie', `token=${adminToken}`).send(roleData).expect(400);
    });

    test('should validate required fields', async () => {
      const invalidRoleData = {
        // Missing name and title
        description: 'Invalid role data',
      };

      await request(app).post('/api/v1/role').set('Cookie', `token=${adminToken}`).send(invalidRoleData).expect(400);
    });

    test('should validate role name format', async () => {
      const invalidRoleData = {
        name: 'Invalid Role Name!', // Contains spaces and special chars
        title: 'Invalid Role',
        description: 'Role with invalid name format',
      };

      await request(app).post('/api/v1/role').set('Cookie', `token=${adminToken}`).send(invalidRoleData).expect(400);
    });

    test('should validate access level enum', async () => {
      const invalidRoleData = {
        name: 'invalid_access_role',
        title: 'Invalid Access Role',
        accessLevel: 'invalid_level',
      };

      await request(app).post('/api/v1/role').set('Cookie', `token=${adminToken}`).send(invalidRoleData).expect(400);
    });
  });

  describe('PUT /api/v1/role/:id', () => {
    test('should update role successfully', async () => {
      const updateData = {
        title: 'Updated Test Role',
        description: 'Updated description',
        accessLevel: 'all',
      };

      const response = await request(app)
        .put(`/api/v1/role/${testRole.id}`)
        .set('Cookie', `token=${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.accessLevel).toBe(updateData.accessLevel);
    });

    test('should prevent updating protected role name', async () => {
      // Assuming admin role is protected
      const updateData = {
        name: 'new_admin_name',
      };

      await request(app)
        .put(`/api/v1/role/${adminUser.roleId}`)
        .set('Cookie', `token=${adminToken}`)
        .send(updateData)
        .expect(400);
    });

    test('should prevent duplicate role names on update', async () => {
      const anotherRole = await TestDataFactory.createRole({
        name: 'another_role',
        title: 'Another Role',
      });

      const updateData = {
        name: anotherRole.name, // Trying to use existing name
      };

      await request(app)
        .put(`/api/v1/role/${testRole.id}`)
        .set('Cookie', `token=${adminToken}`)
        .send(updateData)
        .expect(400);
    });
  });

  describe('DELETE /api/v1/role/:id', () => {
    test('should delete role successfully', async () => {
      await request(app).delete(`/api/v1/role/${testRole.id}`).set('Cookie', `token=${adminToken}`).expect(200);

      // Verify role is deleted
      await request(app).get(`/api/v1/role/${testRole.id}`).set('Cookie', `token=${adminToken}`).expect(404);
    });

    test('should prevent deleting protected roles', async () => {
      await request(app).delete(`/api/v1/role/${adminUser.roleId}`).set('Cookie', `token=${adminToken}`).expect(400);
    });

    test('should prevent deleting role with assigned users', async () => {
      // Assign user to test role
      await db.update(schema.users).set({ roleId: testRole.id }).where(schema.eq(schema.users.id, regularUser.id));

      await request(app).delete(`/api/v1/role/${testRole.id}`).set('Cookie', `token=${adminToken}`).expect(400);
    });
  });

  describe('GET /api/v1/role/permissions', () => {
    test('should get all available permissions', async () => {
      const response = await request(app)
        .get('/api/v1/role/permissions')
        .set('Cookie', `token=${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/role/:id/permissions', () => {
    test('should assign permissions to role', async () => {
      const permissionData = {
        permissionIds: [testPermission.id],
      };

      const response = await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${adminToken}`)
        .send(permissionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.permissions).toBeDefined();
      expect(response.body.data.permissions.some((p: any) => p.id === testPermission.id)).toBe(true);
    });

    test('should validate permission IDs', async () => {
      const invalidData = {
        permissionIds: [99999], // Non-existent permission
      };

      await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${adminToken}`)
        .send(invalidData)
        .expect(400);
    });

    test('should prevent duplicate permission assignment', async () => {
      // First assignment
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      const permissionData = {
        permissionIds: [testPermission.id],
      };

      await request(app)
        .post(`/api/v1/role/${testRole.id}/permissions`)
        .set('Cookie', `token=${adminToken}`)
        .send(permissionData)
        .expect(400);
    });
  });

  describe('DELETE /api/v1/role/:id/permissions/:permissionId', () => {
    beforeEach(async () => {
      // Assign permission to role for removal tests
      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });
    });

    test('should remove permission from role', async () => {
      const response = await request(app)
        .delete(`/api/v1/role/${testRole.id}/permissions/${testPermission.id}`)
        .set('Cookie', `token=${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.permissions.some((p: any) => p.id === testPermission.id)).toBe(false);
    });

    test('should return 404 for non-assigned permission', async () => {
      const anotherPermission = await TestDataFactory.createPermission({
        name: 'another_permission',
      });

      await request(app)
        .delete(`/api/v1/role/${testRole.id}/permissions/${anotherPermission.id}`)
        .set('Cookie', `token=${adminToken}`)
        .expect(404);
    });
  });

  describe('GET /api/v1/role/:id/users', () => {
    test('should get users assigned to role', async () => {
      // Assign user to test role
      await db.update(schema.users).set({ roleId: testRole.id }).where(schema.eq(schema.users.id, regularUser.id));

      const response = await request(app)
        .get(`/api/v1/role/${testRole.id}/users`)
        .set('Cookie', `token=${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.users.some((u: any) => u.id === regularUser.id)).toBe(true);
    });

    test('should support user search within role', async () => {
      // Assign user with specific name to role
      const namedUser = await TestDataFactory.createUser({
        name: 'Searchable User',
        roleId: testRole.id,
      });

      const response = await request(app)
        .get(`/api/v1/role/${testRole.id}/users?search=Searchable`)
        .set('Cookie', `token=${adminToken}`)
        .expect(200);

      expect(response.body.data.users.some((u: any) => u.id === namedUser.id)).toBe(true);
    });
  });

  describe('GET /api/v1/role/:id/stats', () => {
    test('should get role statistics', async () => {
      // Assign user and permission to role
      await db.update(schema.users).set({ roleId: testRole.id }).where(schema.eq(schema.users.id, regularUser.id));

      await db.insert(schema.rolePermissions).values({
        roleId: testRole.id,
        permissionId: testPermission.id,
      });

      const response = await request(app)
        .get(`/api/v1/role/${testRole.id}/stats`)
        .set('Cookie', `token=${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.roleId).toBe(testRole.id);
      expect(response.body.data.roleName).toBe(testRole.name);
      expect(response.body.data.userCount).toBe(1);
      expect(response.body.data.permissionCount).toBe(1);
      expect(response.body.data.permissions).toContain(testPermission.name);
    });
  });
});
