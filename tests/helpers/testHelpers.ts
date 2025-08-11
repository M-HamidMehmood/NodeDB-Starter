import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import request, { type Response } from 'supertest';
import app from '../../src/app';
import { db } from '../../src/db/connection';
import * as schema from '../../src/db/schema';
import { createJWT } from '../../src/utils/jwt';

export type TestUser = schema.User & { token?: string };

export type TestRole = schema.Role;

export type TestPermission = schema.Permission;

// Test data factory
export class TestDataFactory {
  static async createRole(overrides: Partial<schema.NewRole> = {}): Promise<TestRole> {
    const roleData: schema.NewRole = {
      name: overrides.name ?? `test_role_${Date.now()}`,
      title: overrides.title ?? 'Test Role',
      description: overrides.description ?? 'A test role for testing purposes',
      accessLevel: overrides.accessLevel ?? 'any',
    };

    const [role] = await db.insert(schema.roles).values(roleData).returning();
    return role;
  }

  static async createPermission(overrides: Partial<schema.NewPermission> = {}): Promise<TestPermission> {
    const permissionData: schema.NewPermission = {
      name: overrides.name ?? `test_permission_${Date.now()}`,
      description: overrides.description ?? 'A test permission for testing purposes',
    };

    const [permission] = await db.insert(schema.permissions).values(permissionData).returning();
    return permission;
  }

  static async createUser(overrides: Partial<schema.NewUser> = {}): Promise<TestUser> {
    // Create default role if no roleId provided
    let { roleId } = overrides;
    if (!roleId) {
      const role = await this.createRole({ name: 'user', title: 'User' });
      roleId = role.id;
    }

    const userData: schema.NewUser = {
      name: overrides.name ?? `Test User ${Date.now()}`,
      email: overrides.email ?? `test${Date.now()}@example.com`,
      passwordHash: overrides.passwordHash ?? (await bcrypt.hash('password123', 10)),
      roleId,
      isVerified: overrides.isVerified ?? true,
      verificationToken: overrides.verificationToken,
      verifiedAt: overrides.verifiedAt,
      passwordResetToken: overrides.passwordResetToken,
      passwordResetExpires: overrides.passwordResetExpires,
      createdAt: overrides.createdAt,
      updatedAt: overrides.updatedAt,
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

  static async loginUser(email: string, password: string): Promise<Response> {
    const response = await request(app).post('/api/v1/auth/login').send({ email, password });

    return response;
  }

  static async registerUser(userData: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): Promise<Response> {
    const response = await request(app).post('/api/v1/auth/register').send(userData);

    return response;
  }

  static extractTokenFromCookie(response: Response): string | null {
    const setCookieHeader = response.headers['set-cookie'] as unknown;
    if (!setCookieHeader) return null;

    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader].filter(Boolean);
    const tokenCookie = cookies.find((cookie: string) => typeof cookie === 'string' && cookie.startsWith('token='));
    if (!tokenCookie) return null;

    const match = tokenCookie.match(/token=s%3A([^;]+)/);
    return match ? match[1] : null;
  }
}

// Database helpers
export class DatabaseHelpers {
  static async getUserByEmail(email: string) {
    const result = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return result[0];
  }

  static async getUserById(id: number) {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return result[0];
  }

  static async getRoleById(id: number) {
    const result = await db.select().from(schema.roles).where(eq(schema.roles.id, id)).limit(1);
    return result[0];
  }

  static async getUserPermissions(userId: number): Promise<string[]> {
    const user = await this.getUserById(userId);
    if (!user) return [];

    const permissions = await db
      .select({ name: schema.permissions.name })
      .from(schema.permissions)
      .innerJoin(schema.rolePermissions, eq(schema.permissions.id, schema.rolePermissions.permissionId))
      .where(eq(schema.rolePermissions.roleId, user.roleId));

    return permissions.map(p => p.name);
  }
}

// Assertion helpers
export class AssertionHelpers {
  static expectSuccessResponse(response: Response, expectedStatus = 200) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message');
  }

  static expectErrorResponse(response: Response, expectedStatus: number, expectedMessage?: string) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');

    if (expectedMessage) {
      expect(response.body.message).toContain(expectedMessage);
    }
  }

  static expectValidationError(response: Response, fieldName?: string) {
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Validation failed');
    expect(response.body).toHaveProperty('errors');
    expect(Array.isArray(response.body.errors)).toBe(true);

    if (fieldName) {
      const fieldError = response.body.errors.find((error: { field: string }) => error.field === fieldName);
      expect(fieldError).toBeDefined();
    }
  }

  static expectAuthenticationError(response: Response) {
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('Authentication');
  }

  static expectAuthorizationError(response: Response) {
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
