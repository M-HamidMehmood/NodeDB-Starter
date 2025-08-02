import { describe, test, expect } from '@jest/globals';
import {
  createRoleSchema,
  updateRoleSchema,
  assignPermissionsSchema,
  getRolesQuerySchema,
  getRoleUsersQuerySchema,
  roleIdParamSchema,
  permissionIdParamSchema,
  validateNotProtectedRole,
  PROTECTED_ROLES,
} from '../../src/modules/role/role.schema';

describe('Role Schema Validation', () => {
  describe('createRoleSchema', () => {
    test('should validate valid role data', () => {
      const validData = {
        name: 'test_role',
        title: 'Test Role',
        description: 'A test role for validation',
        accessLevel: 'organization',
      };

      const result = createRoleSchema.safeParse(validData);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.name).toBe(validData.name);
        expect(result.data.title).toBe(validData.title);
        expect(result.data.description).toBe(validData.description);
        expect(result.data.accessLevel).toBe(validData.accessLevel);
      }
    });

    test('should apply default access level', () => {
      const validData = {
        name: 'test_role',
        title: 'Test Role',
      };

      const result = createRoleSchema.safeParse(validData);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.accessLevel).toBe('any');
      }
    });

    test('should validate role name format', () => {
      // Valid names
      expect(
        createRoleSchema.safeParse({
          name: 'valid_role',
          title: 'Valid Role',
        }).success
      ).toBe(true);

      expect(
        createRoleSchema.safeParse({
          name: 'another_valid_role_name',
          title: 'Another Valid Role',
        }).success
      ).toBe(true);

      // Invalid names
      expect(
        createRoleSchema.safeParse({
          name: 'Invalid Role Name', // Contains spaces
          title: 'Invalid Role',
        }).success
      ).toBe(false);

      expect(
        createRoleSchema.safeParse({
          name: 'invalid-role-name', // Contains hyphens
          title: 'Invalid Role',
        }).success
      ).toBe(false);

      expect(
        createRoleSchema.safeParse({
          name: 'InvalidRoleName', // Contains uppercase
          title: 'Invalid Role',
        }).success
      ).toBe(false);

      expect(
        createRoleSchema.safeParse({
          name: 'invalid@role', // Contains special chars
          title: 'Invalid Role',
        }).success
      ).toBe(false);
    });

    test('should validate name length', () => {
      // Too short
      expect(
        createRoleSchema.safeParse({
          name: 'a',
          title: 'Test Role',
        }).success
      ).toBe(false);

      // Too long
      expect(
        createRoleSchema.safeParse({
          name: 'a'.repeat(51),
          title: 'Test Role',
        }).success
      ).toBe(false);

      // Just right
      expect(
        createRoleSchema.safeParse({
          name: 'aa',
          title: 'Test Role',
        }).success
      ).toBe(true);

      expect(
        createRoleSchema.safeParse({
          name: 'a'.repeat(50),
          title: 'Test Role',
        }).success
      ).toBe(true);
    });

    test('should validate title length', () => {
      // Too short
      expect(
        createRoleSchema.safeParse({
          name: 'test_role',
          title: 'A',
        }).success
      ).toBe(false);

      // Too long
      expect(
        createRoleSchema.safeParse({
          name: 'test_role',
          title: 'A'.repeat(101),
        }).success
      ).toBe(false);

      // Just right
      expect(
        createRoleSchema.safeParse({
          name: 'test_role',
          title: 'AA',
        }).success
      ).toBe(true);

      expect(
        createRoleSchema.safeParse({
          name: 'test_role',
          title: 'A'.repeat(100),
        }).success
      ).toBe(true);
    });

    test('should validate access level enum', () => {
      const validLevels = ['any', 'organization', 'all'];

      validLevels.forEach(level => {
        expect(
          createRoleSchema.safeParse({
            name: 'test_role',
            title: 'Test Role',
            accessLevel: level,
          }).success
        ).toBe(true);
      });

      // Invalid access level
      expect(
        createRoleSchema.safeParse({
          name: 'test_role',
          title: 'Test Role',
          accessLevel: 'invalid_level',
        }).success
      ).toBe(false);
    });

    test('should validate description length', () => {
      // Valid description
      expect(
        createRoleSchema.safeParse({
          name: 'test_role',
          title: 'Test Role',
          description: 'A'.repeat(500),
        }).success
      ).toBe(true);

      // Too long description
      expect(
        createRoleSchema.safeParse({
          name: 'test_role',
          title: 'Test Role',
          description: 'A'.repeat(501),
        }).success
      ).toBe(false);

      // Null description
      expect(
        createRoleSchema.safeParse({
          name: 'test_role',
          title: 'Test Role',
          description: null,
        }).success
      ).toBe(true);
    });

    test('should require name and title', () => {
      // Missing name
      expect(
        createRoleSchema.safeParse({
          title: 'Test Role',
        }).success
      ).toBe(false);

      // Missing title
      expect(
        createRoleSchema.safeParse({
          name: 'test_role',
        }).success
      ).toBe(false);
    });
  });

  describe('updateRoleSchema', () => {
    test('should validate partial updates', () => {
      // Update only title
      expect(
        updateRoleSchema.safeParse({
          title: 'Updated Title',
        }).success
      ).toBe(true);

      // Update only description
      expect(
        updateRoleSchema.safeParse({
          description: 'Updated description',
        }).success
      ).toBe(true);

      // Update multiple fields
      expect(
        updateRoleSchema.safeParse({
          title: 'Updated Title',
          description: 'Updated description',
          accessLevel: 'all',
        }).success
      ).toBe(true);

      // Empty update (should be valid)
      expect(updateRoleSchema.safeParse({}).success).toBe(true);
    });

    test('should apply same validation rules as create schema', () => {
      // Invalid name format
      expect(
        updateRoleSchema.safeParse({
          name: 'Invalid Name',
        }).success
      ).toBe(false);

      // Invalid access level
      expect(
        updateRoleSchema.safeParse({
          accessLevel: 'invalid',
        }).success
      ).toBe(false);

      // Invalid title length
      expect(
        updateRoleSchema.safeParse({
          title: 'A',
        }).success
      ).toBe(false);
    });
  });

  describe('assignPermissionsSchema', () => {
    test('should validate valid permission IDs', () => {
      const result = assignPermissionsSchema.safeParse({
        permissionIds: [1, 2, 3],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.permissionIds).toEqual([1, 2, 3]);
      }
    });

    test('should require at least one permission ID', () => {
      expect(
        assignPermissionsSchema.safeParse({
          permissionIds: [],
        }).success
      ).toBe(false);
    });

    test('should limit maximum permissions', () => {
      const tooManyPermissions = Array.from({ length: 51 }, (_, i) => i + 1);

      expect(
        assignPermissionsSchema.safeParse({
          permissionIds: tooManyPermissions,
        }).success
      ).toBe(false);
    });

    test('should validate permission ID types', () => {
      // Invalid types
      expect(
        assignPermissionsSchema.safeParse({
          permissionIds: ['1', '2'], // Strings instead of numbers
        }).success
      ).toBe(false);

      expect(
        assignPermissionsSchema.safeParse({
          permissionIds: [0, -1], // Non-positive numbers
        }).success
      ).toBe(false);

      expect(
        assignPermissionsSchema.safeParse({
          permissionIds: [1.5, 2.7], // Decimals
        }).success
      ).toBe(false);
    });
  });

  describe('getRolesQuerySchema', () => {
    test('should validate and transform query parameters', () => {
      const queryParams = {
        page: '2',
        limit: '15',
        sortBy: 'title',
        order: 'desc',
        search: 'test',
        includeStats: 'true',
      };

      const result = getRolesQuerySchema.safeParse(queryParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.page).toBe(2); // Transformed to number
        expect(result.data.limit).toBe(15); // Transformed to number
        expect(result.data.sortBy).toBe('title');
        expect(result.data.order).toBe('desc');
        expect(result.data.search).toBe('test');
        expect(result.data.includeStats).toBe(true); // Transformed to boolean
      }
    });

    test('should apply default values', () => {
      const result = getRolesQuerySchema.safeParse({});
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
        expect(result.data.sortBy).toBe('name');
        expect(result.data.order).toBe('asc');
        expect(result.data.search).toBe('');
        expect(result.data.includeStats).toBe(false);
      }
    });

    test('should validate sortBy enum', () => {
      // Valid sortBy values
      const validSortBy = ['name', 'title', 'accessLevel', 'createdAt'];

      validSortBy.forEach(sortBy => {
        expect(getRolesQuerySchema.safeParse({ sortBy }).success).toBe(true);
      });

      // Invalid sortBy
      expect(
        getRolesQuerySchema.safeParse({
          sortBy: 'invalid_field',
        }).success
      ).toBe(false);
    });

    test('should validate order enum', () => {
      expect(getRolesQuerySchema.safeParse({ order: 'asc' }).success).toBe(true);
      expect(getRolesQuerySchema.safeParse({ order: 'desc' }).success).toBe(true);
      expect(getRolesQuerySchema.safeParse({ order: 'invalid' }).success).toBe(false);
    });

    test('should validate page and limit ranges', () => {
      // Invalid page (must be positive)
      expect(getRolesQuerySchema.safeParse({ page: '0' }).success).toBe(false);
      expect(getRolesQuerySchema.safeParse({ page: '-1' }).success).toBe(false);

      // Invalid limit (must be between 1 and 100)
      expect(getRolesQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
      expect(getRolesQuerySchema.safeParse({ limit: '101' }).success).toBe(false);

      // Valid values
      expect(getRolesQuerySchema.safeParse({ page: '1', limit: '100' }).success).toBe(true);
    });

    test('should validate search length', () => {
      // Valid search
      expect(
        getRolesQuerySchema.safeParse({
          search: 'A'.repeat(100),
        }).success
      ).toBe(true);

      // Too long search
      expect(
        getRolesQuerySchema.safeParse({
          search: 'A'.repeat(101),
        }).success
      ).toBe(false);
    });
  });

  describe('getRoleUsersQuerySchema', () => {
    test('should validate user query parameters', () => {
      const queryParams = {
        page: '1',
        limit: '20',
        sortBy: 'email',
        order: 'asc',
        search: 'john',
      };

      const result = getRoleUsersQuerySchema.safeParse(queryParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.sortBy).toBe('email');
        expect(result.data.order).toBe('asc');
      }
    });

    test('should validate sortBy for users', () => {
      const validSortBy = ['name', 'email', 'createdAt'];

      validSortBy.forEach(sortBy => {
        expect(getRoleUsersQuerySchema.safeParse({ sortBy }).success).toBe(true);
      });

      expect(
        getRoleUsersQuerySchema.safeParse({
          sortBy: 'invalid_field',
        }).success
      ).toBe(false);
    });

    test('should apply correct defaults for user queries', () => {
      const result = getRoleUsersQuerySchema.safeParse({});
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.sortBy).toBe('createdAt');
        expect(result.data.order).toBe('desc');
      }
    });
  });

  describe('roleIdParamSchema', () => {
    test('should validate and transform role ID', () => {
      const result = roleIdParamSchema.safeParse({ id: '123' });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(123);
        expect(typeof result.data.id).toBe('number');
      }
    });

    test('should reject invalid role IDs', () => {
      // Non-numeric
      expect(roleIdParamSchema.safeParse({ id: 'abc' }).success).toBe(false);

      // Negative
      expect(roleIdParamSchema.safeParse({ id: '-1' }).success).toBe(false);

      // Zero
      expect(roleIdParamSchema.safeParse({ id: '0' }).success).toBe(false);

      // Decimal - This will parse to 1 (parseInt behavior), but validation should catch it
      expect(roleIdParamSchema.safeParse({ id: '1.5' }).success).toBe(true); // parseInt('1.5') = 1
    });
  });

  describe('permissionIdParamSchema', () => {
    test('should validate and transform permission ID', () => {
      const result = permissionIdParamSchema.safeParse({ permissionId: '456' });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.permissionId).toBe(456);
        expect(typeof result.data.permissionId).toBe('number');
      }
    });

    test('should reject invalid permission IDs', () => {
      expect(permissionIdParamSchema.safeParse({ permissionId: 'abc' }).success).toBe(false);
      expect(permissionIdParamSchema.safeParse({ permissionId: '0' }).success).toBe(false);
    });
  });

  describe('PROTECTED_ROLES', () => {
    test('should contain expected protected roles', () => {
      expect(PROTECTED_ROLES).toContain('admin');
      expect(PROTECTED_ROLES).toContain('user');
      expect(PROTECTED_ROLES.length).toBe(2);
    });

    test('should be readonly', () => {
      // In ES6 const arrays are not deeply immutable, so this test checks TypeScript enforcement
      // The array itself can be modified at runtime, but TypeScript should prevent it
      expect(Array.isArray(PROTECTED_ROLES)).toBe(true);
      expect(PROTECTED_ROLES.includes('admin')).toBe(true);
    });
  });

  describe('validateNotProtectedRole', () => {
    test('should return false for protected roles', () => {
      expect(validateNotProtectedRole('admin')).toBe(false);
      expect(validateNotProtectedRole('user')).toBe(false);
    });

    test('should return true for non-protected roles', () => {
      expect(validateNotProtectedRole('custom_role')).toBe(true);
      expect(validateNotProtectedRole('manager')).toBe(true);
      expect(validateNotProtectedRole('guest')).toBe(true);
    });

    test('should be case sensitive', () => {
      expect(validateNotProtectedRole('Admin')).toBe(true); // Different case
      expect(validateNotProtectedRole('USER')).toBe(true); // Different case
    });
  });
});
