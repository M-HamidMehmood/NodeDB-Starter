import { z } from 'zod';

export const userIdSchema = z.object({
  id: z
    .string()
    .or(z.number().int().positive())
    .transform(val => Number(val))
    .refine(val => !Number.isNaN(val) && val > 0, {
      message: 'ID must be a valid positive number',
    }),
});

export const updateUserSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .optional(),
  email: z.string().email('Invalid email format').optional(),
});

export const updatePasswordSchema = z.object({
  oldPassword: z.string().min(6, 'Old password must be at least 6 characters'),
  newPassword: z
    .string()
    .min(6, 'New password must be at least 6 characters')
    .max(50, 'New password must be less than 50 characters'),
  confirmNewPassword: z.string().min(6, 'Confirm new password must be at least 6 characters'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "New passwords don't match",
  path: ["confirmNewPassword"],
});

export const getUsersQuerySchema = z.object({
  page: z
    .string()
    .transform(val => Number(val) || 1)
    .optional()
    .default('1'),
  limit: z
    .string()
    .transform(val => Number(val) || 10)
    .optional()
    .default('10'),
  sortBy: z.string().optional().default('id'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  search: z.string().optional(),
});

export type UserIdSchema = z.infer<typeof userIdSchema>;
export type UpdateUserSchema = z.infer<typeof updateUserSchema>;
export type UpdatePasswordSchema = z.infer<typeof updatePasswordSchema>;
export type GetUsersQuerySchema = z.infer<typeof getUsersQuerySchema>;
