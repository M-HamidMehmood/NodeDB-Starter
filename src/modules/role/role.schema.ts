import { z } from 'zod';

// Base role schema for creation
export const createRoleSchema = z.object({
  name: z
    .string()
    .min(2, 'Role name must be at least 2 characters')
    .max(50, 'Role name cannot exceed 50 characters')
    .regex(/^[a-z_]+$/, 'Role name must be lowercase with underscores only'),
  title: z
    .string()
    .min(2, 'Role title must be at least 2 characters')
    .max(100, 'Role title cannot exceed 100 characters'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
  accessLevel: z
    .enum(['any', 'organization', 'all'], {
      errorMap: () => ({ message: 'Access level must be any, organization, or all' }),
    })
    .default('any'),
});

// Schema for updating roles (all fields optional except validation)
export const updateRoleSchema = z.object({
  name: z
    .string()
    .min(2, 'Role name must be at least 2 characters')
    .max(50, 'Role name cannot exceed 50 characters')
    .regex(/^[a-z_]+$/, 'Role name must be lowercase with underscores only')
    .optional(),
  title: z
    .string()
    .min(2, 'Role title must be at least 2 characters')
    .max(100, 'Role title cannot exceed 100 characters')
    .optional(),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
  accessLevel: z
    .enum(['any', 'organization', 'all'], {
      errorMap: () => ({ message: 'Access level must be any, organization, or all' }),
    })
    .optional(),
});

// Schema for assigning permissions to a role
export const assignPermissionsSchema = z.object({
  permissionIds: z
    .array(z.number().int().positive('Permission ID must be a positive integer'))
    .min(1, 'At least one permission ID is required')
    .max(50, 'Cannot assign more than 50 permissions at once'),
});

// Schema for removing a single permission
export const removePermissionSchema = z.object({
  permissionId: z.number().int().positive('Permission ID must be a positive integer'),
});

// Query parameters schema for listing roles
export const getRolesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 1))
    .refine(val => val > 0, 'Page must be a positive number'),
  limit: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 10))
    .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
  sortBy: z.enum(['name', 'title', 'accessLevel', 'createdAt']).optional().default('name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  search: z.string().max(100, 'Search term cannot exceed 100 characters').optional().default(''),
  includeStats: z
    .string()
    .optional()
    .default('false')
    .transform(val => val === 'true'),
});

// Query parameters schema for getting role users
export const getRoleUsersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 1))
    .refine(val => val > 0, 'Page must be a positive number'),
  limit: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 10))
    .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
  sortBy: z.enum(['name', 'email', 'createdAt']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().max(100, 'Search term cannot exceed 100 characters').optional().default(''),
});

// Parameter validation schemas
export const roleIdParamSchema = z.object({
  id: z
    .string()
    .transform(val => parseInt(val, 10))
    .refine(val => !Number.isNaN(val) && val > 0, 'Role ID must be a positive number'),
});

export const permissionIdParamSchema = z.object({
  permissionId: z
    .string()
    .transform(val => parseInt(val, 10))
    .refine(val => !Number.isNaN(val) && val > 0, 'Permission ID must be a positive number'),
});

// Combined schemas for route parameter + body validation
export const updateRoleWithParamsSchema = z.object({
  params: roleIdParamSchema,
  body: updateRoleSchema,
});

export const assignPermissionsWithParamsSchema = z.object({
  params: roleIdParamSchema,
  body: assignPermissionsSchema,
});

export const removePermissionWithParamsSchema = z.object({
  params: roleIdParamSchema.merge(permissionIdParamSchema),
});

// Type exports for TypeScript
export type CreateRoleSchema = z.infer<typeof createRoleSchema>;
export type UpdateRoleSchema = z.infer<typeof updateRoleSchema>;
export type AssignPermissionsSchema = z.infer<typeof assignPermissionsSchema>;
export type RemovePermissionSchema = z.infer<typeof removePermissionSchema>;
export type GetRolesQuerySchema = z.infer<typeof getRolesQuerySchema>;
export type GetRoleUsersQuerySchema = z.infer<typeof getRoleUsersQuerySchema>;
export type RoleIdParamSchema = z.infer<typeof roleIdParamSchema>;
export type PermissionIdParamSchema = z.infer<typeof permissionIdParamSchema>;

// Protected role names that cannot be deleted or modified
export const PROTECTED_ROLES = ['admin', 'user'] as const;

// Validation for protected role operations
export const validateNotProtectedRole = (roleName: string): boolean =>
  !PROTECTED_ROLES.includes(roleName as (typeof PROTECTED_ROLES)[number]);
