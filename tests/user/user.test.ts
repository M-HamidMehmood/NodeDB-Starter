import { describe, expect, test } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { apiHelper, assertHelper, dbHelper, testFactory } from '../helpers/testHelpers';

describe('User API', () => {
  describe('GET /api/v1/user/', () => {
    test('should get all users with manage_users permission', async () => {
      // Create admin user with manage_users permission
      const adminUser = await testFactory.createAuthenticatedUser(['manage_users']);

      // Create some test users
      await testFactory.createUser({ name: 'User 1', email: 'user1@example.com' });
      await testFactory.createUser({ name: 'User 2', email: 'user2@example.com' });

      const response = await apiHelper.authenticatedRequest(adminUser.token).get('/api/v1/user/');

      assertHelper.expectSuccessResponse(response);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3); // admin + 2 test users
    });

    test('should fail without authentication', async () => {
      const response = await apiHelper.request().get('/api/v1/user/');

      assertHelper.expectAuthenticationError(response);
    });

    test('should fail without manage_users permission', async () => {
      const user = await testFactory.createAuthenticatedUser([]); // No permissions

      const response = await apiHelper.authenticatedRequest(user.token).get('/api/v1/user/');

      assertHelper.expectAuthorizationError(response);
    });

    test('should support pagination', async () => {
      const adminUser = await testFactory.createAuthenticatedUser(['manage_users']);

      // Create multiple users
      for (let i = 0; i < 5; i++) {
        await testFactory.createUser({
          name: `User ${i}`,
          email: `user${i}@example.com`,
        });
      }

      const response = await apiHelper
        .authenticatedRequest(adminUser.token)
        .get('/api/v1/user/')
        .query({ page: 1, limit: 3 });

      assertHelper.expectSuccessResponse(response);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeLessThanOrEqual(3);
    });

    test('should support search by name', async () => {
      const adminUser = await testFactory.createAuthenticatedUser(['manage_users']);

      await testFactory.createUser({ name: 'John Doe', email: 'john@example.com' });
      await testFactory.createUser({ name: 'Jane Smith', email: 'jane@example.com' });

      const response = await apiHelper
        .authenticatedRequest(adminUser.token)
        .get('/api/v1/user/')
        .query({ search: 'John' });

      assertHelper.expectSuccessResponse(response);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.some((user: any) => user.name.includes('John'))).toBe(true);
    });
  });

  describe('GET /api/v1/user/me', () => {
    test('should get current user profile', async () => {
      const user = await testFactory.createAuthenticatedUser();

      const response = await apiHelper.authenticatedRequest(user.token).get('/api/v1/user/me');

      assertHelper.expectSuccessResponse(response);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(user.id);
      expect(response.body.data.email).toBe(user.email);
      expect(response.body.data.name).toBe(user.name);
      // Password should not be included
      expect(response.body.data.passwordHash).toBeUndefined();
    });

    test('should fail without authentication', async () => {
      const response = await apiHelper.request().get('/api/v1/user/me');

      assertHelper.expectAuthenticationError(response);
    });
  });

  describe('GET /api/v1/user/:id', () => {
    test('should get user by id when authenticated', async () => {
      const user = await testFactory.createAuthenticatedUser();
      const targetUser = await testFactory.createUser({
        name: 'Target User',
        email: 'target@example.com',
      });

      const response = await apiHelper.authenticatedRequest(user.token).get(`/api/v1/user/${targetUser.id}`);

      assertHelper.expectSuccessResponse(response);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(targetUser.id);
      expect(response.body.data.email).toBe(targetUser.email);
      expect(response.body.data.name).toBe(targetUser.name);
      // Password should not be included
      expect(response.body.data.passwordHash).toBeUndefined();
    });

    test('should fail without authentication', async () => {
      const targetUser = await testFactory.createUser();

      const response = await apiHelper.request().get(`/api/v1/user/${targetUser.id}`);

      assertHelper.expectAuthenticationError(response);
    });

    test('should fail for non-existent user', async () => {
      const user = await testFactory.createAuthenticatedUser();

      const response = await apiHelper.authenticatedRequest(user.token).get('/api/v1/user/99999');

      assertHelper.expectErrorResponse(response, 404, 'No user with id');
    });

    test('should fail with invalid id format', async () => {
      const user = await testFactory.createAuthenticatedUser();

      const response = await apiHelper.authenticatedRequest(user.token).get('/api/v1/user/invalid-id');

      assertHelper.expectValidationError(response, 'id');
    });
  });

  describe('PUT /api/v1/user/:id', () => {
    test('should update own profile', async () => {
      const user = await testFactory.createAuthenticatedUser();

      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      const response = await apiHelper.authenticatedRequest(user.token).put(`/api/v1/user/${user.id}`).send(updateData);

      assertHelper.expectSuccessResponse(response);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.email).toBe(updateData.email);

      // Verify in database
      const updatedUser = await dbHelper.getUserById(user.id);
      expect(updatedUser.name).toBe(updateData.name);
      expect(updatedUser.email).toBe(updateData.email);
    });

    test('should update other user with manage_users permission', async () => {
      const adminUser = await testFactory.createAuthenticatedUser(['manage_users']);
      const targetUser = await testFactory.createUser();

      const updateData = {
        name: 'Admin Updated Name',
        email: 'admin-updated@example.com',
      };

      const response = await apiHelper
        .authenticatedRequest(adminUser.token)
        .put(`/api/v1/user/${targetUser.id}`)
        .send(updateData);

      assertHelper.expectSuccessResponse(response);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.email).toBe(updateData.email);
    });

    test('should fail to update other user without manage_users permission', async () => {
      const user = await testFactory.createAuthenticatedUser([]);
      const targetUser = await testFactory.createUser();

      const updateData = {
        name: 'Unauthorized Update',
      };

      const response = await apiHelper
        .authenticatedRequest(user.token)
        .put(`/api/v1/user/${targetUser.id}`)
        .send(updateData);

      assertHelper.expectAuthorizationError(response);
    });

    test('should fail without authentication', async () => {
      const targetUser = await testFactory.createUser();

      const response = await apiHelper.request().put(`/api/v1/user/${targetUser.id}`).send({ name: 'New Name' });

      assertHelper.expectAuthenticationError(response);
    });

    test('should fail with invalid email format', async () => {
      const user = await testFactory.createAuthenticatedUser();

      const response = await apiHelper
        .authenticatedRequest(user.token)
        .put(`/api/v1/user/${user.id}`)
        .send({ email: 'invalid-email' });

      assertHelper.expectValidationError(response, 'email');
    });

    test('should fail with duplicate email', async () => {
      const user = await testFactory.createAuthenticatedUser();
      const otherUser = await testFactory.createUser({ email: 'existing@example.com' });

      const response = await apiHelper
        .authenticatedRequest(user.token)
        .put(`/api/v1/user/${user.id}`)
        .send({ email: 'existing@example.com' });

      assertHelper.expectErrorResponse(response, 400, 'email already exists');
    });

    test('should update JWT token when updating own profile', async () => {
      const user = await testFactory.createAuthenticatedUser();

      const updateData = {
        name: 'New Name',
        email: 'new@example.com',
      };

      const response = await apiHelper.authenticatedRequest(user.token).put(`/api/v1/user/${user.id}`).send(updateData);

      assertHelper.expectSuccessResponse(response);

      // Check if new token cookie is set
      const setCookieHeader = response.headers['set-cookie'] as unknown;
      const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader].filter(Boolean);
      const tokenCookie = cookies.find((cookie: string) => typeof cookie === 'string' && cookie.startsWith('token='));
      expect(tokenCookie).toBeDefined();
    });

    test('should handle partial updates', async () => {
      const user = await testFactory.createAuthenticatedUser();
      const originalEmail = user.email;

      const response = await apiHelper
        .authenticatedRequest(user.token)
        .put(`/api/v1/user/${user.id}`)
        .send({ name: 'Only Name Updated' });

      assertHelper.expectSuccessResponse(response);
      expect(response.body.data.name).toBe('Only Name Updated');
      expect(response.body.data.email).toBe(originalEmail); // Should remain unchanged
    });

    test('should fail for non-existent user', async () => {
      const user = await testFactory.createAuthenticatedUser(['manage_users']);

      const response = await apiHelper
        .authenticatedRequest(user.token)
        .put('/api/v1/user/99999')
        .send({ name: 'New Name' });

      assertHelper.expectErrorResponse(response, 404, 'User not found');
    });
  });

  describe('POST /api/v1/user/update-password', () => {
    test('should update password successfully', async () => {
      const oldPassword = 'OldPassword123!';
      const newPassword = 'NewPassword123!';

      const user = await testFactory.createUser({
        passwordHash: await bcrypt.hash(oldPassword, 10),
        isVerified: true,
      });

      // Login to get token
      const loginResponse = await apiHelper.loginUser(user.email, oldPassword);
      const token = apiHelper.extractTokenFromCookie(loginResponse);
      expect(token).toBeDefined();

      const response = await apiHelper.authenticatedRequest(token!).post('/api/v1/user/update-password').send({
        oldPassword,
        newPassword,
        confirmNewPassword: newPassword,
      });

      assertHelper.expectSuccessResponse(response);
      expect(response.body.message).toContain('Password updated successfully');

      // Verify old password no longer works
      const oldLoginResponse = await apiHelper.loginUser(user.email, oldPassword);
      assertHelper.expectErrorResponse(oldLoginResponse, 401);

      // Verify new password works
      const newLoginResponse = await apiHelper.loginUser(user.email, newPassword);
      assertHelper.expectSuccessResponse(newLoginResponse);
    });

    test('should fail without authentication', async () => {
      const response = await apiHelper.request().post('/api/v1/user/update-password').send({
        oldPassword: 'old',
        newPassword: 'new',
        confirmNewPassword: 'new',
      });

      assertHelper.expectAuthenticationError(response);
    });

    test('should fail with incorrect old password', async () => {
      const user = await testFactory.createAuthenticatedUser();

      const response = await apiHelper.authenticatedRequest(user.token).post('/api/v1/user/update-password').send({
        oldPassword: 'WrongPassword',
        newPassword: 'NewPassword123!',
        confirmNewPassword: 'NewPassword123!',
      });

      assertHelper.expectErrorResponse(response, 400, 'Current password is incorrect');
    });

    test('should fail when new passwords do not match', async () => {
      const user = await testFactory.createAuthenticatedUser();

      const response = await apiHelper.authenticatedRequest(user.token).post('/api/v1/user/update-password').send({
        oldPassword: 'password123',
        newPassword: 'NewPassword123!',
        confirmNewPassword: 'DifferentPassword123!',
      });

      assertHelper.expectValidationError(response);
    });

    test('should fail with weak new password', async () => {
      const user = await testFactory.createAuthenticatedUser();

      const response = await apiHelper.authenticatedRequest(user.token).post('/api/v1/user/update-password').send({
        oldPassword: 'password123',
        newPassword: '123',
        confirmNewPassword: '123',
      });

      assertHelper.expectValidationError(response, 'newPassword');
    });

    test('should fail when new password is same as old password', async () => {
      const password = 'SamePassword123!';
      const user = await testFactory.createAuthenticatedUser();

      const response = await apiHelper.authenticatedRequest(user.token).post('/api/v1/user/update-password').send({
        oldPassword: password,
        newPassword: password,
        confirmNewPassword: password,
      });

      assertHelper.expectErrorResponse(response, 400, 'New password must be different');
    });
  });

  describe('User Authorization and Access Control', () => {
    test('should respect role-based access control', async () => {
      // Create users with different roles
      const adminUser = await testFactory.createUserWithRole('admin', ['manage_users', 'view_users']);
      const moderatorUser = await testFactory.createUserWithRole('moderator', ['view_users']);
      const regularUser = await testFactory.createUserWithRole('user', []);

      // Admin should access all users
      const adminToken = apiHelper.extractTokenFromCookie(await apiHelper.loginUser(adminUser.email, 'password123'));
      const adminResponse = await apiHelper.authenticatedRequest(adminToken!).get('/api/v1/user/');
      assertHelper.expectSuccessResponse(adminResponse);

      // Moderator should not manage users
      const moderatorToken = apiHelper.extractTokenFromCookie(
        await apiHelper.loginUser(moderatorUser.email, 'password123')
      );
      const moderatorResponse = await apiHelper.authenticatedRequest(moderatorToken!).get('/api/v1/user/');
      assertHelper.expectAuthorizationError(moderatorResponse);

      // Regular user should not access user list
      const userToken = apiHelper.extractTokenFromCookie(await apiHelper.loginUser(regularUser.email, 'password123'));
      const userResponse = await apiHelper.authenticatedRequest(userToken!).get('/api/v1/user/');
      assertHelper.expectAuthorizationError(userResponse);
    });

    test('should allow users to access their own profile regardless of permissions', async () => {
      const user = await testFactory.createUserWithRole('user', []); // No permissions

      const token = apiHelper.extractTokenFromCookie(await apiHelper.loginUser(user.email, 'password123'));

      const response = await apiHelper.authenticatedRequest(token!).get('/api/v1/user/me');

      assertHelper.expectSuccessResponse(response);
      expect(response.body.data.id).toBe(user.id);
    });

    test('should prevent users from accessing other users without permission', async () => {
      const user1 = await testFactory.createUserWithRole('user', []);
      const user2 = await testFactory.createUserWithRole('user', []);

      const token = apiHelper.extractTokenFromCookie(await apiHelper.loginUser(user1.email, 'password123'));

      const response = await apiHelper
        .authenticatedRequest(token!)
        .put(`/api/v1/user/${user2.id}`)
        .send({ name: 'Hacked Name' });

      assertHelper.expectAuthorizationError(response);
    });
  });

  describe('User Data Validation and Security', () => {
    test('should not expose sensitive data in responses', async () => {
      const user = await testFactory.createAuthenticatedUser();

      const response = await apiHelper.authenticatedRequest(user.token).get('/api/v1/user/me');

      assertHelper.expectSuccessResponse(response);
      expect(response.body.data.passwordHash).toBeUndefined();
      expect(response.body.data.passwordResetToken).toBeUndefined();
      expect(response.body.data.verificationToken).toBeUndefined();
    });

    test('should validate email uniqueness across all users', async () => {
      const user1 = await testFactory.createUser({ email: 'unique@example.com' });
      const user2 = await testFactory.createAuthenticatedUser();

      const response = await apiHelper
        .authenticatedRequest(user2.token)
        .put(`/api/v1/user/${user2.id}`)
        .send({ email: 'unique@example.com' });

      assertHelper.expectErrorResponse(response, 400, 'email already exists');
    });

    test('should handle malformed request data gracefully', async () => {
      const user = await testFactory.createAuthenticatedUser();

      const response = await apiHelper
        .authenticatedRequest(user.token)
        .put(`/api/v1/user/${user.id}`)
        .send({
          name: null as unknown as string,
          email: undefined as unknown as string,
          invalidField: 'should be ignored',
        });

      // Should either succeed with valid data or fail with validation error
      expect([200, 400]).toContain(response.status);
    });
  });
});
