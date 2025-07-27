import { describe, test, expect } from '@jest/globals';
import { z } from 'zod';

// Import schemas directly (they don't require database)
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../src/modules/auth/auth.schema';

describe('Auth Schema Validation', () => {
  describe('registerSchema', () => {
    test('should validate valid registration data', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      };

      expect(() => registerSchema.parse(validData)).not.toThrow();
    });

    test('should reject invalid email', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      };

      expect(() => registerSchema.parse(invalidData)).toThrow(z.ZodError);
    });

    test('should reject weak password', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: '123',
        confirmPassword: '123',
      };

      expect(() => registerSchema.parse(invalidData)).toThrow(z.ZodError);
    });

    test('should reject mismatched passwords', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!',
      };

      expect(() => registerSchema.parse(invalidData)).toThrow(z.ZodError);
    });

    test('should reject missing fields', () => {
      const invalidData = {
        name: 'John Doe',
        // missing email, password, confirmPassword
      };

      expect(() => registerSchema.parse(invalidData)).toThrow(z.ZodError);
    });
  });

  describe('loginSchema', () => {
    test('should validate valid login data', () => {
      const validData = {
        email: 'john@example.com',
        password: 'password123',
      };

      expect(() => loginSchema.parse(validData)).not.toThrow();
    });

    test('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'password123',
      };

      expect(() => loginSchema.parse(invalidData)).toThrow(z.ZodError);
    });

    test('should reject missing password', () => {
      const invalidData = {
        email: 'john@example.com',
      };

      expect(() => loginSchema.parse(invalidData)).toThrow(z.ZodError);
    });
  });

  describe('verifyEmailSchema', () => {
    test('should validate valid verification data', () => {
      const validData = {
        email: 'john@example.com',
        verificationToken: 'valid-token-123',
      };

      expect(() => verifyEmailSchema.parse(validData)).not.toThrow();
    });

    test('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        verificationToken: 'valid-token-123',
      };

      expect(() => verifyEmailSchema.parse(invalidData)).toThrow(z.ZodError);
    });

    test('should reject missing token', () => {
      const invalidData = {
        email: 'john@example.com',
      };

      expect(() => verifyEmailSchema.parse(invalidData)).toThrow(z.ZodError);
    });
  });

  describe('forgotPasswordSchema', () => {
    test('should validate valid email', () => {
      const validData = {
        email: 'john@example.com',
      };

      expect(() => forgotPasswordSchema.parse(validData)).not.toThrow();
    });

    test('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
      };

      expect(() => forgotPasswordSchema.parse(invalidData)).toThrow(z.ZodError);
    });
  });

  describe('resetPasswordSchema', () => {
    test('should validate valid reset data', () => {
      const validData = {
        email: 'john@example.com',
        token: 'reset-token-123',
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      expect(() => resetPasswordSchema.parse(validData)).not.toThrow();
    });

    test('should reject weak password', () => {
      const invalidData = {
        email: 'john@example.com',
        token: 'reset-token-123',
        password: '123',
        confirmPassword: '123',
      };

      expect(() => resetPasswordSchema.parse(invalidData)).toThrow(z.ZodError);
    });

    test('should reject mismatched passwords', () => {
      const invalidData = {
        email: 'john@example.com',
        token: 'reset-token-123',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!',
      };

      expect(() => resetPasswordSchema.parse(invalidData)).toThrow(z.ZodError);
    });
  });
});