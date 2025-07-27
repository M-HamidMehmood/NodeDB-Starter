import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Tables
export const roles = pgTable('Roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  accessLevel: text('accessLevel').notNull().default('any'),
});

export const users = pgTable('Users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  roleId: integer('roleId')
    .notNull()
    .references(() => roles.id)
    .default(2), // Default to user role
  isVerified: boolean('isVerified').default(false),
  verificationToken: text('verificationToken'),
  verifiedAt: timestamp('verifiedAt'),
  passwordResetToken: text('passwordResetToken'),
  passwordResetExpires: timestamp('passwordResetExpires'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const permissions = pgTable('Permissions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const rolePermissions = pgTable(
  'RolePermissions',
  {
    roleId: integer('roleId')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: integer('permissionId')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  table => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
  })
);

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
