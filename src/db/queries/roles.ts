import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { db } from '../connection';
import { permissions, rolePermissions, roles, users, type NewRole, type NewRolePermission, type Role } from '../schema';

export type RoleWithPermissions = Role & {
  permissions: Array<{
    id: number;
    name: string;
    description: string | null;
  }>;
};

export type RoleWithStats = Role & {
  userCount: number;
  permissionCount: number;
  permissions: Array<{
    id: number;
    name: string;
    description: string | null;
  }>;
};

export const getRoleById = async (id: number): Promise<Role | null> => {
  const result = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  return result[0] || null;
};

export const getRoleByName = async (name: string): Promise<Role | null> => {
  const result = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
  return result[0] || null;
};

export const getRoleWithPermissions = async (id: number): Promise<RoleWithPermissions | null> => {
  const roleResult = await db.select().from(roles).where(eq(roles.id, id)).limit(1);

  if (!roleResult[0]) return null;

  // Get permissions for the role
  const permissionResult = await db
    .select({
      id: permissions.id,
      name: permissions.name,
      description: permissions.description,
    })
    .from(permissions)
    .innerJoin(rolePermissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.roleId, id));

  return {
    ...roleResult[0],
    permissions: permissionResult,
  };
};

export const getAllRoles = async (params: {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  search?: string;
  includeStats?: boolean;
}): Promise<{
  roles: (Role | RoleWithStats)[];
  totalRoles: number;
  totalPages: number;
  currentPage: number;
}> => {
  const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', search = '', includeStats = false } = params;

  const offset = (page - 1) * limit;

  // Build where condition
  const whereCondition = search
    ? or(ilike(roles.name, `%${search}%`), ilike(roles.title, `%${search}%`), ilike(roles.description, `%${search}%`))
    : undefined;

  // Build order by
  let orderBy;
  switch (sortBy) {
    case 'name':
      orderBy = order === 'asc' ? asc(roles.name) : desc(roles.name);
      break;
    case 'title':
      orderBy = order === 'asc' ? asc(roles.title) : desc(roles.title);
      break;
    case 'accessLevel':
      orderBy = order === 'asc' ? asc(roles.accessLevel) : desc(roles.accessLevel);
      break;
    default:
      orderBy = order === 'asc' ? asc(roles.name) : desc(roles.name);
  }

  // Get roles with pagination
  const roleResults = await db.select().from(roles).where(whereCondition).orderBy(orderBy).limit(limit).offset(offset);

  // Get total count
  const totalCountResult = await db.select({ count: count() }).from(roles).where(whereCondition);
  const totalRoles = totalCountResult[0]?.count || 0;

  let enrichedRoles: (Role | RoleWithStats)[] = roleResults;

  if (includeStats) {
    // Enrich with stats and permissions
    enrichedRoles = await Promise.all(
      roleResults.map(async role => {
        // Get user count for this role
        const userCountResult = await db.select({ count: count() }).from(users).where(eq(users.roleId, role.id));

        // Get permissions for this role
        const permissionResult = await db
          .select({
            id: permissions.id,
            name: permissions.name,
            description: permissions.description,
          })
          .from(permissions)
          .innerJoin(rolePermissions, eq(permissions.id, rolePermissions.permissionId))
          .where(eq(rolePermissions.roleId, role.id));

        return {
          ...role,
          userCount: userCountResult[0]?.count || 0,
          permissionCount: permissionResult.length,
          permissions: permissionResult,
        } as RoleWithStats;
      })
    );
  }

  return {
    roles: enrichedRoles,
    totalRoles,
    totalPages: Math.ceil(totalRoles / limit),
    currentPage: page,
  };
};

export const createRole = async (roleData: NewRole): Promise<Role> => {
  const result = await db.insert(roles).values(roleData).returning();
  if (!result[0]) {
    throw new Error('Failed to create role');
  }
  return result[0];
};

export const updateRole = async (id: number, roleData: Partial<NewRole>): Promise<Role | null> => {
  const result = await db.update(roles).set(roleData).where(eq(roles.id, id)).returning();
  return result[0] || null;
};

export const deleteRole = async (id: number): Promise<boolean> => {
  // Check if role has users
  const userCount = await db.select({ count: count() }).from(users).where(eq(users.roleId, id));

  if (userCount[0] && userCount[0].count > 0) {
    throw new Error('Cannot delete role that has assigned users');
  }

  // Delete role permissions first
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));

  // Delete role
  const result = await db.delete(roles).where(eq(roles.id, id)).returning();
  return result.length > 0;
};

export const assignPermissionToRole = async (roleId: number, permissionId: number): Promise<void> => {
  // Check if role exists
  const role = await getRoleById(roleId);
  if (!role) {
    throw new Error('Role not found');
  }

  // Check if permission exists
  const permission = await db.select().from(permissions).where(eq(permissions.id, permissionId)).limit(1);
  if (!permission[0]) {
    throw new Error('Permission not found');
  }

  // Check if already assigned
  const existing = await db
    .select()
    .from(rolePermissions)
    .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)))
    .limit(1);

  if (existing[0]) {
    throw new Error('Permission already assigned to role');
  }

  // Assign permission
  await db.insert(rolePermissions).values({ roleId, permissionId });
};

export const removePermissionFromRole = async (roleId: number, permissionId: number): Promise<boolean> => {
  const result = await db
    .delete(rolePermissions)
    .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)))
    .returning();

  return result.length > 0;
};

export const assignMultiplePermissionsToRole = async (roleId: number, permissionIds: number[]): Promise<void> => {
  // Check if role exists
  const role = await getRoleById(roleId);
  if (!role) {
    throw new Error('Role not found');
  }

  // Get current permissions
  const currentPermissions = await db
    .select({ permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId));

  const currentPermissionIds = currentPermissions.map(p => p.permissionId);

  // Filter out already assigned permissions
  const newPermissionIds = permissionIds.filter(id => !currentPermissionIds.includes(id));

  if (newPermissionIds.length === 0) {
    return; // No new permissions to assign
  }

  // Validate all permissions exist
  const permissionChecks = await Promise.all(
    newPermissionIds.map(async permissionId => {
      const permissionExists = await db
        .select({ id: permissions.id })
        .from(permissions)
        .where(eq(permissions.id, permissionId))
        .limit(1);

      if (!permissionExists[0]) {
        throw new Error(`Permission with ID ${permissionId} not found`);
      }
      return permissionId;
    })
  );

  if (permissionChecks.length !== newPermissionIds.length) {
    throw new Error('Failed to validate all permissions');
  }

  // Assign all new permissions
  const values: NewRolePermission[] = newPermissionIds.map(permissionId => ({
    roleId,
    permissionId,
  }));

  await db.insert(rolePermissions).values(values);
};

export const getRoleUsers = async (
  roleId: number,
  params: {
    page?: number;
    limit?: number;
    sortBy?: string;
    order?: 'asc' | 'desc';
    search?: string;
  }
) => {
  const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', search = '' } = params;
  const offset = (page - 1) * limit;

  // Build where condition
  let whereCondition: SQL<unknown> = eq(users.roleId, roleId);
  if (search) {
    const searchCondition = or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`));
    whereCondition = and(whereCondition, searchCondition) as SQL<unknown>;
  }

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

  // Get users
  const query = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isVerified: users.isVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const userResults = await query.where(whereCondition);

  // Get total count
  const countQuery = db.select({ count: count() }).from(users);

  const totalCountResult = await countQuery.where(whereCondition);

  const totalUsers = totalCountResult[0]?.count || 0;

  return {
    users: userResults,
    totalUsers,
    totalPages: Math.ceil(totalUsers / limit),
    currentPage: page,
  };
};
