import { describe, test, expect, beforeEach } from '@jest/globals';
import bcrypt from 'bcrypt';
import { testFactory, apiHelper, dbHelper, assertHelper } from '../helpers/testHelpers';
import { cleanDatabase } from '../setup';

describe('Auth API', () => {
  describe('POST /api/v1/auth/register', () => {
    test('should register a new user successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      };

      const response = await apiHelper.registerUser(userData);

      assertHelper.expectSuccessResponse(response, 201);
      expect(response.body.message).toContain('Please check your email');

      // Verify user was created in database
      const user = await dbHelper.getUserByEmail(userData.email);
      expect(user).toBeDefined();
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
      expect(user.isVerified).toBe(false);
      expect(user.verificationToken).toBeDefined();
    });

    test('should fail with invalid email format', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      };

      const response = await apiHelper.registerUser(userData);

      assertHelper.expectValidationError(response, 'email');
    });

    test('should fail with weak password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: '123',
        confirmPassword: '123',
      };

      const response = await apiHelper.registerUser(userData);

      assertHelper.expectValidationError(response, 'password');
    });

    test('should fail when passwords do not match', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!',
      };

      const response = await apiHelper.registerUser(userData);

      assertHelper.expectValidationError(response);
    });

    test('should fail when email already exists', async () => {
      const existingUser = await testFactory.createUser({
        email: 'existing@example.com',
      });

      const userData = {
        name: 'John Doe',
        email: 'existing@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      };

      const response = await apiHelper.registerUser(userData);

      assertHelper.expectErrorResponse(response, 400, 'already exists');
    });

    test('should fail with missing required fields', async () => {
      const response = await apiHelper.request().post('/api/v1/auth/register').send({
        name: 'John Doe',
        // missing email, password, confirmPassword
      });

      assertHelper.expectValidationError(response);
    });
  });

  describe('POST /api/v1/auth/verify-email', () => {
    test('should verify email successfully', async () => {
      const user = await testFactory.createUser({
        isVerified: false,
        verificationToken: 'valid-token',
      });

      const response = await apiHelper.request().post('/api/v1/auth/verify-email').send({
        email: user.email,
        verificationToken: 'valid-token',
      });

      assertHelper.expectSuccessResponse(response);
      expect(response.body.message).toContain('verified successfully');

      // Verify user is now verified in database
      const updatedUser = await dbHelper.getUserByEmail(user.email);
      expect(updatedUser.isVerified).toBe(true);
      expect(updatedUser.verificationToken).toBeNull();
    });

    test('should fail with invalid token', async () => {
      const user = await testFactory.createUser({
        isVerified: false,
        verificationToken: 'valid-token',
      });

      const response = await apiHelper.request().post('/api/v1/auth/verify-email').send({
        email: user.email,
        verificationToken: 'invalid-token',
      });

      assertHelper.expectErrorResponse(response, 400, 'Invalid verification token');
    });

    test('should fail with non-existent email', async () => {
      const response = await apiHelper.request().post('/api/v1/auth/verify-email').send({
        email: 'nonexistent@example.com',
        verificationToken: 'some-token',
      });

      assertHelper.expectErrorResponse(response, 404, 'User not found');
    });

    test('should fail for already verified user', async () => {
      const user = await testFactory.createUser({
        isVerified: true,
        verificationToken: null,
      });

      const response = await apiHelper.request().post('/api/v1/auth/verify-email').send({
        email: user.email,
        verificationToken: 'some-token',
      });

      assertHelper.expectErrorResponse(response, 400, 'already verified');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    test('should login successfully with valid credentials', async () => {
      const password = 'Password123!';
      const user = await testFactory.createUser({
        email: 'user@example.com',
        passwordHash: await bcrypt.hash(password, 10),
        isVerified: true,
      });

      const response = await apiHelper.loginUser(user.email, password);

      assertHelper.expectSuccessResponse(response);
      expect(response.body.message).toContain('Login successful');

      // Check if token cookie is set
      const tokenCookie = response.headers['set-cookie']?.find((cookie: string) => cookie.startsWith('token='));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toContain('HttpOnly');
    });

    test('should fail with invalid email', async () => {
      const response = await apiHelper.loginUser('nonexistent@example.com', 'password');

      assertHelper.expectErrorResponse(response, 401, 'Invalid credentials');
    });

    test('should fail with invalid password', async () => {
      const user = await testFactory.createUser({
        email: 'user@example.com',
        passwordHash: await bcrypt.hash('correctpassword', 10),
        isVerified: true,
      });

      const response = await apiHelper.loginUser(user.email, 'wrongpassword');

      assertHelper.expectErrorResponse(response, 401, 'Invalid credentials');
    });

    test('should fail with unverified email', async () => {
      const password = 'Password123!';
      const user = await testFactory.createUser({
        email: 'unverified@example.com',
        passwordHash: await bcrypt.hash(password, 10),
        isVerified: false,
      });

      const response = await apiHelper.loginUser(user.email, password);

      assertHelper.expectErrorResponse(response, 401, 'Please verify your email');
    });

    test('should fail with invalid email format', async () => {
      const response = await apiHelper.request().post('/api/v1/auth/login').send({
        email: 'invalid-email',
        password: 'password',
      });

      assertHelper.expectValidationError(response, 'email');
    });

    test('should fail with missing credentials', async () => {
      const response = await apiHelper.request().post('/api/v1/auth/login').send({});

      assertHelper.expectValidationError(response);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    test('should logout successfully', async () => {
      const userWithToken = await testFactory.createAuthenticatedUser();

      const response = await apiHelper.authenticatedRequest(userWithToken.token).post('/api/v1/auth/logout');

      assertHelper.expectSuccessResponse(response);
      expect(response.body.message).toContain('Logged out successfully');

      // Check if token cookie is cleared
      const tokenCookie = response.headers['set-cookie']?.find((cookie: string) => cookie.startsWith('token='));
      expect(tokenCookie).toContain('token=;');
    });

    test('should logout successfully even without authentication', async () => {
      // Logout should work even if user is not authenticated
      const response = await apiHelper.request().post('/api/v1/auth/logout');

      assertHelper.expectSuccessResponse(response);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    test('should send password reset email for valid user', async () => {
      const user = await testFactory.createUser({
        email: 'user@example.com',
        isVerified: true,
      });

      const response = await apiHelper.request().post('/api/v1/auth/forgot-password').send({
        email: user.email,
      });

      assertHelper.expectSuccessResponse(response);
      expect(response.body.message).toContain('password reset instructions');

      // Verify reset token was set in database
      const updatedUser = await dbHelper.getUserByEmail(user.email);
      expect(updatedUser.passwordResetToken).toBeDefined();
      expect(updatedUser.passwordResetExpires).toBeDefined();
    });

    test('should return success even for non-existent email (security)', async () => {
      const response = await apiHelper.request().post('/api/v1/auth/forgot-password').send({
        email: 'nonexistent@example.com',
      });

      // Should return success to prevent email enumeration
      assertHelper.expectSuccessResponse(response);
      expect(response.body.message).toContain('password reset instructions');
    });

    test('should fail with invalid email format', async () => {
      const response = await apiHelper.request().post('/api/v1/auth/forgot-password').send({
        email: 'invalid-email',
      });

      assertHelper.expectValidationError(response, 'email');
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    test('should reset password successfully with valid token', async () => {
      const resetToken = 'valid-reset-token';
      const user = await testFactory.createUser({
        passwordResetToken: resetToken,
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        isVerified: true,
      });

      const newPassword = 'NewPassword123!';
      const response = await apiHelper.request().post('/api/v1/auth/reset-password').send({
        email: user.email,
        token: resetToken,
        password: newPassword,
        confirmPassword: newPassword,
      });

      assertHelper.expectSuccessResponse(response);
      expect(response.body.message).toContain('Password reset successful');

      // Verify password was changed and reset token cleared
      const updatedUser = await dbHelper.getUserByEmail(user.email);
      expect(updatedUser.passwordResetToken).toBeNull();
      expect(updatedUser.passwordResetExpires).toBeNull();

      // Verify new password works
      const loginResponse = await apiHelper.loginUser(user.email, newPassword);
      assertHelper.expectSuccessResponse(loginResponse);
    });

    test('should fail with invalid token', async () => {
      const user = await testFactory.createUser({
        passwordResetToken: 'valid-token',
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
        isVerified: true,
      });

      const response = await apiHelper.request().post('/api/v1/auth/reset-password').send({
        email: user.email,
        token: 'invalid-token',
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      });

      assertHelper.expectErrorResponse(response, 400, 'Invalid or expired reset token');
    });

    test('should fail with expired token', async () => {
      const resetToken = 'expired-token';
      const user = await testFactory.createUser({
        passwordResetToken: resetToken,
        passwordResetExpires: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        isVerified: true,
      });

      const response = await apiHelper.request().post('/api/v1/auth/reset-password').send({
        email: user.email,
        token: resetToken,
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      });

      assertHelper.expectErrorResponse(response, 400, 'Invalid or expired reset token');
    });

    test('should fail when passwords do not match', async () => {
      const resetToken = 'valid-token';
      const user = await testFactory.createUser({
        passwordResetToken: resetToken,
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
        isVerified: true,
      });

      const response = await apiHelper.request().post('/api/v1/auth/reset-password').send({
        email: user.email,
        token: resetToken,
        password: 'NewPassword123!',
        confirmPassword: 'DifferentPassword123!',
      });

      assertHelper.expectValidationError(response);
    });

    test('should fail with weak password', async () => {
      const resetToken = 'valid-token';
      const user = await testFactory.createUser({
        passwordResetToken: resetToken,
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
        isVerified: true,
      });

      const response = await apiHelper.request().post('/api/v1/auth/reset-password').send({
        email: user.email,
        token: resetToken,
        password: '123',
        confirmPassword: '123',
      });

      assertHelper.expectValidationError(response, 'password');
    });
  });
});
