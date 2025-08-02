import request from 'supertest';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import app from '../../src/app';
import { db } from '../../src/db/connection';
import * as schema from '../../src/db/schema';
import { createJWT } from '../../src/utils/jwt';

export interface TestUser {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  roleId: number;
  isVerified: boolean;
  verificationToken?: string;
  token?: string;
}

export interface TestRole {
  id: number;
  name: string;
  title: string;
  description: string | null;
  accessLevel: string;
}

export interface TestPermission {
  id: number;
  name: string;
  description: string | null;
}

// Test data factory
export class TestDataFactory {
  static async createRole(overrides: Partial<TestRole> = {}): Promise<TestRole> {
    const roleData = {
      name: `test_role_${Date.now()}`,
      title: 'Test Role',
      description: 'A test role for testing purposes',
      accessLevel: 'any',
      ...overrides,
    };

    const [role] = await db.insert(schema.roles).values(roleData).returning();
    return role;
  }

  static async createPermission(overrides: Partial<TestPermission> = {}): Promise<TestPermission> {
    const permissionData = {
      name: `test_permission_${Date.now()}`,
      description: 'A test permission for testing purposes',
      ...overrides,
    };

    const [permission] = await db.insert(schema.permissions).values(permissionData).returning();
    return permission;
  }

  static async createUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
    // Create default role if no roleId provided
    let { roleId } = overrides;
    if (!roleId) {
      const role = await this.createRole({ name: 'user', title: 'User' });
      roleId = role.id;
    }

    const userData = {
      name: `Test User ${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      passwordHash: await bcrypt.hash('password123', 10),
      roleId,
      isVerified: true,
      ...overrides,
    };

    const [user] = await db.insert(schema.users).values(userData).returning();
    return user;
  }

  static async createUserWithRole(
    roleName: string,
    permissions: string[] = []
  ): Promise<TestUser & { role: TestRole; permissions: TestPermission[] }> {
    // Create role
    const role = await this.createRole({ name: roleName, title: roleName });

    // Create permissions and associate with role
    const createdPermissions: TestPermission[] = [];
    for (const permissionName of permissions) {
      const permission = await this.createPermission({ name: permissionName });
      await db.insert(schema.rolePermissions).values({
        roleId: role.id,
        permissionId: permission.id,
      });
      createdPermissions.push(permission);
    }

    // Create user with role
    const user = await this.createUser({ roleId: role.id });

    return {
      ...user,
      role,
      permissions: createdPermissions,
    };
  }

  static async createAuthenticatedUser(permissions: string[] = []): Promise<TestUser & { token: string }> {
    const userData = await this.createUserWithRole('authenticated_user', permissions);

    const tokenPayload = {
      userId: userData.id,
      email: userData.email,
      name: userData.name,
      roleId: userData.roleId,
      permissions,
    };

    const token = createJWT(tokenPayload);

    return {
      ...userData,
      token,
    };
  }

  static generateToken(user: TestUser, permissions: string[] = []): string {
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      permissions,
    };

    return createJWT(tokenPayload);
  }
}

// API test helpers
export class ApiTestHelpers {
  static request() {
    return request(app);
  }

  static authenticatedRequest(token: string) {
    return request(app).set('Cookie', [`token=s%3A${token}`]);
  }

  static async loginUser(email: string, password: string) {
    const response = await request(app).post('/api/v1/auth/login').send({ email, password });

    return response;
  }

  static async registerUser(userData: { name: string; email: string; password: string; confirmPassword: string }) {
    const response = await request(app).post('/api/v1/auth/register').send(userData);

    return response;
  }

  static extractTokenFromCookie(response: any): string | null {
    const setCookieHeader = response.headers['set-cookie'];
    if (!setCookieHeader) return null;

    const tokenCookie = setCookieHeader.find((cookie: string) => cookie.startsWith('token='));
    if (!tokenCookie) return null;

    const match = tokenCookie.match(/token=s%3A([^;]+)/);
    return match ? match[1] : null;
  }
}

// Database helpers
export class DatabaseHelpers {
  static async getUserByEmail(email: string) {
    const [user] = await db.select().from(schema.users).where(schema.users.email.eq(email)).limit(1);
    return user;
  }

  static async getUserById(id: number) {
    const [user] = await db.select().from(schema.users).where(schema.users.id.eq(id)).limit(1);
    return user;
  }

  static async getRoleById(id: number) {
    const [role] = await db.select().from(schema.roles).where(schema.roles.id.eq(id)).limit(1);
    return role;
  }

  static async getUserPermissions(userId: number): Promise<string[]> {
    const user = await this.getUserById(userId);
    if (!user) return [];

    const permissions = await db
      .select({ name: schema.permissions.name })
      .from(schema.permissions)
      .innerJoin(schema.rolePermissions, schema.permissions.id.eq(schema.rolePermissions.permissionId))
      .where(schema.rolePermissions.roleId.eq(user.roleId));

    return permissions.map(p => p.name);
  }
}

// Assertion helpers
export class AssertionHelpers {
  static expectSuccessResponse(response: any, expectedStatus = 200) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message');
  }

  static expectErrorResponse(response: any, expectedStatus: number, expectedMessage?: string) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');

    if (expectedMessage) {
      expect(response.body.message).toContain(expectedMessage);
    }
  }

  static expectValidationError(response: any, fieldName?: string) {
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Validation failed');
    expect(response.body).toHaveProperty('errors');
    expect(Array.isArray(response.body.errors)).toBe(true);

    if (fieldName) {
      const fieldError = response.body.errors.find((error: any) => error.field === fieldName);
      expect(fieldError).toBeDefined();
    }
  }

  static expectAuthenticationError(response: any) {
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('Authentication');
  }

  static expectAuthorizationError(response: any) {
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('permission');
  }
}

// Export commonly used instances
export const testFactory = TestDataFactory;
export const apiHelper = ApiTestHelpers;
export const dbHelper = DatabaseHelpers;
export const assertHelper = AssertionHelpers;
