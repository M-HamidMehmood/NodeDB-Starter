import bcrypt from 'bcryptjs';
import { env } from '../../config/config';
import { db } from './connection';
import { permissions, rolePermissions, roles, users } from './schema';

// Roles data
const roleData = [
  {
    id: 1,
    name: 'admin',
    title: 'Administrator',
    description: 'Full access to all system features',
    accessLevel: 'all',
  },
  {
    id: 2,
    name: 'user',
    title: 'Standard User',
    description: 'Regular user with limited access',
    accessLevel: 'organization',
  },
];

// Permissions data
const permissionData = [
  {
    id: 1,
    name: 'manage_users',
    description: 'Can create, read, update, and delete users',
  },
  {
    id: 2,
    name: 'view_users',
    description: 'Can view user information',
  },
  {
    id: 3,
    name: 'manage_roles',
    description: 'Can create, read, update, and delete roles',
  },
  {
    id: 4,
    name: 'view_roles',
    description: 'Can view role information',
  },
];

// Role-Permission mappings
const rolePermissionData = [
  // Admin has all permissions
  { roleId: 1, permissionId: 1 },
  { roleId: 1, permissionId: 2 },
  { roleId: 1, permissionId: 3 },
  { roleId: 1, permissionId: 4 },
  // User has limited permissions
  { roleId: 2, permissionId: 2 },
  { roleId: 2, permissionId: 4 },
];

// Default users
const userData = [
  {
    id: 1,
    name: 'Admin User',
    email: 'admin@mail.com',
    roleId: 1,
    isVerified: true,
  },
  {
    id: 2,
    name: 'User',
    email: 'user@mail.com',
    roleId: 2,
    isVerified: true,
  },
];

async function seed(): Promise<void> {
  try {
    console.log('🌱 Starting database seeding...');

    // Seed roles
    console.log('📝 Seeding roles...');
    await db.insert(roles).values(roleData).onConflictDoNothing();

    // Seed permissions
    console.log('🔐 Seeding permissions...');
    await db.insert(permissions).values(permissionData).onConflictDoNothing();

    // Seed role-permission mappings
    console.log('🔗 Seeding role-permission mappings...');
    await db.insert(rolePermissions).values(rolePermissionData).onConflictDoNothing();

    // Seed users with hashed passwords
    console.log('👥 Seeding users...');
    const usersWithPasswords = await Promise.all(
      userData.map(async user => ({
        ...user,
        passwordHash: await bcrypt.hash('password', env.SALT_ROUNDS),
      }))
    );

    await db.insert(users).values(usersWithPasswords).onConflictDoNothing();

    console.log('✅ Database seeding completed successfully!');
    console.log(`
📊 Seeded:
  - ${roleData.length} roles
  - ${permissionData.length} permissions
  - ${rolePermissionData.length} role-permission mappings
  - ${userData.length} users

🔑 Default login credentials:
  Admin: admin@mail.com / password
  User: user@mail.com / password
    `);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('🎉 Seeding process completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

export { seed };
export default seed;
