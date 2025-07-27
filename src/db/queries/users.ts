import { asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../connection';
import { permissions, rolePermissions, roles, users, type NewUser, type User } from '../schema';

export type UserWithRole = User & {
  role: {
    id: number;
    name: string;
    title: string;
    description: string | null;
    accessLevel: string;
    permissions: Array<{
      id: number;
      name: string;
      description: string | null;
    }>;
  };
};

export const getUserById = async (id: number): Promise<User | null> => {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] || null;
};

export const getUserWithRole = async (email: string): Promise<UserWithRole | null> => {
  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      roleId: users.roleId,
      isVerified: users.isVerified,
      verificationToken: users.verificationToken,
      verifiedAt: users.verifiedAt,
      passwordResetToken: users.passwordResetToken,
      passwordResetExpires: users.passwordResetExpires,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      role: {
        id: roles.id,
        name: roles.name,
        title: roles.title,
        description: roles.description,
        accessLevel: roles.accessLevel,
      },
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.email, email))
    .limit(1);

  if (!result[0]) return null;

  // Get permissions for the role
  const permissionResult = await db
    .select({
      id: permissions.id,
      name: permissions.name,
      description: permissions.description,
    })
    .from(permissions)
    .innerJoin(rolePermissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.roleId, result[0].role.id));

  return {
    ...result[0],
    role: {
      ...result[0].role,
      permissions: permissionResult,
    },
  };
};

export const createUser = async (userData: NewUser): Promise<User> => {
  const result = await db.insert(users).values(userData).returning();
  if (!result[0]) {
    throw new Error('Failed to create user');
  }
  return result[0];
};

export const updateUser = async (id: number, userData: Partial<NewUser>): Promise<User | null> => {
  const result = await db.update(users).set(userData).where(eq(users.id, id)).returning();
  return result[0] || null;
};

export const getAllUsers = async (params: {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  search?: string;
}): Promise<{
  users: User[];
  totalUsers: number;
  totalPages: number;
  currentPage: number;
}> => {
  const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', search = '' } = params;

  const offset = (page - 1) * limit;

  // Build where condition
  const whereCondition = search ? or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`)) : undefined;

  // Build order by
  let orderBy;
  switch (sortBy) {
    case 'name':
      orderBy = order === 'asc' ? asc(users.name) : desc(users.name);
      break;
    case 'email':
      orderBy = order === 'asc' ? asc(users.email) : desc(users.email);
      break;
    default:
      orderBy = order === 'asc' ? asc(users.createdAt) : desc(users.createdAt);
  }

  // Get users with pagination
  const userResults = await db.select().from(users).where(whereCondition).orderBy(orderBy).limit(limit).offset(offset);

  // Get total count
  const totalCountResult = await db.select({ count: count() }).from(users).where(whereCondition);

  const totalUsers = totalCountResult[0]?.count || 0;

  return {
    users: userResults,
    totalUsers,
    totalPages: Math.ceil(totalUsers / limit),
    currentPage: page,
  };
};
