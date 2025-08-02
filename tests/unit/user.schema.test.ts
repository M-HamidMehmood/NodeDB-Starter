import { describe, test, expect } from '@jest/globals';
import { z } from 'zod';

// Import schemas directly (they don't require database)
import {
  updateUserSchema,
  updatePasswordSchema,
  getUsersQuerySchema,
  userIdSchema,
} from '../../src/modules/user/user.schema';

describe('User Schema Validation', () => {
  describe('updateUserSchema', () => {
    test('should validate valid update data', () => {
      const validData = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      expect(() => updateUserSchema.parse(validData)).not.toThrow();
    });

    test('should accept partial updates', () => {
      const validData = {
        name: 'Only Name Updated',
      };

      expect(() => updateUserSchema.parse(validData)).not.toThrow();
    });

    test('should accept empty updates', () => {
      const validData = {};

      expect(() => updateUserSchema.parse(validData)).not.toThrow();
    });

    test('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
      };

      expect(() => updateUserSchema.parse(invalidData)).toThrow(z.ZodError);
    });

    test('should reject invalid name types', () => {
      const invalidData = {
        name: 123, // should be string
      };

      expect(() => updateUserSchema.parse(invalidData)).toThrow(z.ZodError);
    });
  });

  describe('updatePasswordSchema', () => {
    test('should validate valid password update', () => {
      const validData = {
        oldPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        confirmNewPassword: 'NewPassword123!',
      };

      expect(() => updatePasswordSchema.parse(validData)).not.toThrow();
    });

    test('should reject weak new password', () => {
      const invalidData = {
        oldPassword: 'OldPassword123!',
        newPassword: '123',
        confirmNewPassword: '123',
      };

      expect(() => updatePasswordSchema.parse(invalidData)).toThrow(z.ZodError);
    });

    test('should reject mismatched new passwords', () => {
      const invalidData = {
        oldPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        confirmNewPassword: 'DifferentPassword123!',
      };

      expect(() => updatePasswordSchema.parse(invalidData)).toThrow(z.ZodError);
    });

    test('should reject missing old password', () => {
      const invalidData = {
        newPassword: 'NewPassword123!',
        confirmNewPassword: 'NewPassword123!',
      };

      expect(() => updatePasswordSchema.parse(invalidData)).toThrow(z.ZodError);
    });
  });

  describe('getUsersQuerySchema', () => {
    test('should validate valid query parameters', () => {
      const validData = {
        page: '1',
        limit: '10',
        search: 'john',
        sortBy: 'name',
        sortOrder: 'asc' as const,
      };

      expect(() => getUsersQuerySchema.parse(validData)).not.toThrow();
    });

    test('should accept empty query', () => {
      const validData = {};

      expect(() => getUsersQuerySchema.parse(validData)).not.toThrow();
    });

    test('should apply default values', () => {
      const result = getUsersQuerySchema.parse({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.sortBy).toBe('id');
      expect(result.sortOrder).toBe('asc');
    });

    test('should reject invalid page number', () => {
      const invalidData = {
        page: 0, // should be >= 1
      };

      expect(() => getUsersQuerySchema.parse(invalidData)).toThrow(z.ZodError);
    });

    test('should reject invalid limit', () => {
      const invalidData = {
        limit: 101, // should be <= 100
      };

      expect(() => getUsersQuerySchema.parse(invalidData)).toThrow(z.ZodError);
    });

    test('should reject invalid sort order', () => {
      const invalidData = {
        sortOrder: 'invalid', // should be 'asc' or 'desc'
      };

      expect(() => getUsersQuerySchema.parse(invalidData)).toThrow(z.ZodError);
    });
  });

  describe('userIdSchema', () => {
    test('should validate valid user ID', () => {
      const validData = {
        id: '123',
      };

      expect(() => userIdSchema.parse(validData)).not.toThrow();
    });

    test('should convert string to number', () => {
      const result = userIdSchema.parse({ id: '123' });

      expect(result.id).toBe(123);
      expect(typeof result.id).toBe('number');
    });

    test('should reject invalid ID format', () => {
      const invalidData = {
        id: 'not-a-number',
      };

      expect(() => userIdSchema.parse(invalidData)).toThrow(z.ZodError);
    });

    test('should reject negative ID', () => {
      const invalidData = {
        id: '-1',
      };

      expect(() => userIdSchema.parse(invalidData)).toThrow(z.ZodError);
    });

    test('should reject zero ID', () => {
      const invalidData = {
        id: '0',
      };

      expect(() => userIdSchema.parse(invalidData)).toThrow(z.ZodError);
    });
  });
});
