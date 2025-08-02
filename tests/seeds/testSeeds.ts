import bcrypt from 'bcrypt';
import { db } from '../../src/db/connection';
import * as schema from '../../src/db/schema';

export interface SeedData {
  roles: Array<{ id?: number; name: string; title: string; description?: string; accessLevel: string }>;
  permissions: Array<{ id?: number; name: string; description?: string }>;
  users: Array<{
    id?: number;
    name: string;
    email: string;
    password: string;
    roleId?: number;
    isVerified?: boolean;
    verificationToken?: string;
  }>;
  rolePermissions: Array<{ roleId: number; permissionId: number }>;
}

const defaultSeedData: SeedData = {
  roles: [
    { id: 1, name: 'admin', title: 'Administrator', description: 'Full system access', accessLevel: 'admin' },
    { id: 2, name: 'user', title: 'User', description: 'Basic user access', accessLevel: 'user' },
    {
      id: 3,
      name: 'moderator',
      title: 'Moderator',
      description: 'Content moderation access',
      accessLevel: 'moderator',
    },
  ],
  permissions: [
    { id: 1, name: 'manage_users', description: 'Can manage all users' },
    { id: 2, name: 'view_users', description: 'Can view user information' },
    { id: 3, name: 'edit_content', description: 'Can edit content' },
    { id: 4, name: 'delete_content', description: 'Can delete content' },
  ],
  users: [
    {
      id: 1,
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'admin123',
      roleId: 1,
      isVerified: true,
    },
    {
      id: 2,
      name: 'Regular User',
      email: 'user@example.com',
      password: 'user123',
      roleId: 2,
      isVerified: true,
    },
    {
      id: 3,
      name: 'Moderator User',
      email: 'moderator@example.com',
      password: 'moderator123',
      roleId: 3,
      isVerified: true,
    },
  ],
  rolePermissions: [
    { roleId: 1, permissionId: 1 }, // admin -> manage_users
    { roleId: 1, permissionId: 2 }, // admin -> view_users
    { roleId: 1, permissionId: 3 }, // admin -> edit_content
    { roleId: 1, permissionId: 4 }, // admin -> delete_content
    { roleId: 3, permissionId: 2 }, // moderator -> view_users
    { roleId: 3, permissionId: 3 }, // moderator -> edit_content
  ],
};

export async function seedTestDatabase(seedData: SeedData = defaultSeedData) {
  try {
    console.log('🌱 Seeding test database...');

    // Seed roles
    for (const roleData of seedData.roles) {
      await db.insert(schema.roles).values(roleData).onConflictDoNothing();
    }

    // Seed permissions
    for (const permissionData of seedData.permissions) {
      await db.insert(schema.permissions).values(permissionData).onConflictDoNothing();
    }

    // Seed users with hashed passwords
    for (const userData of seedData.users) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const { password, ...userDataWithoutPassword } = userData;

      await db
        .insert(schema.users)
        .values({
          ...userDataWithoutPassword,
          passwordHash: hashedPassword,
        })
        .onConflictDoNothing();
    }

    // Seed role permissions
    for (const rolePermission of seedData.rolePermissions) {
      await db.insert(schema.rolePermissions).values(rolePermission).onConflictDoNothing();
    }

    console.log('✅ Test database seeded successfully');
  } catch (error) {
    console.error('❌ Failed to seed test database:', error);
    throw error;
  }
}

export async function clearTestDatabase() {
  try {
    console.log('🧹 Clearing test database...');

    // Delete in reverse order to respect foreign key constraints
    await db.delete(schema.rolePermissions);
    await db.delete(schema.users);
    await db.delete(schema.permissions);
    await db.delete(schema.roles);

    console.log('✅ Test database cleared successfully');
  } catch (error) {
    console.error('❌ Failed to clear test database:', error);
    throw error;
  }
}
