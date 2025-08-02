import { eq } from 'drizzle-orm';
import { CustomAPIError, BadRequestError, NotFoundError } from '../../../errors';
import {
  assignMultiplePermissionsToRole,
  assignPermissionToRole,
  createRole,
  deleteRole,
  getAllRoles,
  getRoleById,
  getRoleByName,
  getRoleUsers,
  getRoleWithPermissions,
  removePermissionFromRole,
  updateRole,
  type RoleWithPermissions,
} from '../../db/queries/roles';
import { permissions } from '../../db/schema';
import { db } from '../../db/connection';
import { validateNotProtectedRole } from './role.schema';

export type CreateRoleRequest = {
  name: string;
  title: string;
  description?: string | null;
  accessLevel?: string;
};

export type UpdateRoleRequest = {
  name?: string;
  title?: string;
  description?: string | null;
  accessLevel?: string;
};

export type GetRolesRequest = {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  search?: string;
  includeStats?: boolean;
};

export type AssignPermissionsRequest = {
  permissionIds: number[];
};

export type GetRoleUsersRequest = {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  search?: string;
};

export const createRoleService = async (roleData: CreateRoleRequest) => {
  // Check if role name already exists
  const existingRole = await getRoleByName(roleData.name);
  if (existingRole) {
    throw new BadRequestError('Role name already exists');
  }

  try {
    const role = await createRole({
      name: roleData.name,
      title: roleData.title,
      description: roleData.description || null,
      accessLevel: roleData.accessLevel || 'any',
    });

    return role;
  } catch {
    throw new CustomAPIError('Failed to create role');
  }
};

export const getAllRolesService = async (params: GetRolesRequest) => {
  try {
    return await getAllRoles(params);
  } catch {
    throw new CustomAPIError('Failed to fetch roles');
  }
};

export const getRoleByIdService = async (id: number): Promise<RoleWithPermissions> => {
  const role = await getRoleWithPermissions(id);

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  return role;
};

export const updateRoleService = async (id: number, roleData: UpdateRoleRequest) => {
  const existingRole = await getRoleById(id);

  if (!existingRole) {
    throw new NotFoundError('Role not found');
  }

  // Check if it's a protected role and trying to modify name or critical fields
  if (!validateNotProtectedRole(existingRole.name)) {
    if (roleData.name && roleData.name !== existingRole.name) {
      throw new BadRequestError('Cannot modify name of protected role');
    }
    if (roleData.accessLevel && roleData.accessLevel !== existingRole.accessLevel) {
      throw new BadRequestError('Cannot modify access level of protected role');
    }
  }

  // Check if new name already exists (if name is being changed)
  if (roleData.name && roleData.name !== existingRole.name) {
    const nameExists = await getRoleByName(roleData.name);
    if (nameExists) {
      throw new BadRequestError('Role name already exists');
    }
  }

  try {
    const updatedRole = await updateRole(id, roleData);

    if (!updatedRole) {
      throw new CustomAPIError('Failed to update role');
    }

    return await getRoleWithPermissions(id);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new CustomAPIError('Failed to update role', 500);
  }
};

export const deleteRoleService = async (id: number): Promise<void> => {
  const role = await getRoleById(id);

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  // Check if it's a protected role
  if (!validateNotProtectedRole(role.name)) {
    throw new BadRequestError('Cannot delete protected role');
  }

  try {
    await deleteRole(id);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Cannot delete role that has assigned users') {
      throw new BadRequestError('Cannot delete role that has assigned users');
    }
    throw new CustomAPIError('Failed to delete role');
  }
};

export const assignPermissionsToRoleService = async (roleId: number, data: AssignPermissionsRequest) => {
  const role = await getRoleById(roleId);

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  // Validate all permissions exist
  const permissionChecks = await Promise.all(
    data.permissionIds.map(async permissionId => {
      if (typeof permissionId !== 'number' || permissionId <= 0) {
        throw new BadRequestError(`Invalid permission ID: ${permissionId}`);
      }

      const permission = await db
        .select({ id: permissions.id })
        .from(permissions)
        .where(eq(permissions.id, permissionId))
        .limit(1);

      if (!permission[0]) {
        throw new BadRequestError(`Permission with ID ${permissionId} not found`);
      }
      return permissionId;
    })
  );

  if (permissionChecks.length !== data.permissionIds.length) {
    throw new BadRequestError('Failed to validate all permissions');
  }

  try {
    await assignMultiplePermissionsToRole(roleId, data.permissionIds);
    return await getRoleWithPermissions(roleId);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('already assigned')) {
      throw new BadRequestError('One or more permissions already assigned to role');
    }
    throw new CustomAPIError('Failed to assign permissions to role');
  }
};

export const assignSinglePermissionToRoleService = async (roleId: number, permissionId: number) => {
  const role = await getRoleById(roleId);

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  try {
    await assignPermissionToRole(roleId, permissionId);
    return await getRoleWithPermissions(roleId);
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'Role not found') {
        throw new NotFoundError('Role not found');
      }
      if (error.message === 'Permission not found') {
        throw new NotFoundError('Permission not found');
      }
      if (error.message === 'Permission already assigned to role') {
        throw new BadRequestError('Permission already assigned to role');
      }
    }
    throw new CustomAPIError('Failed to assign permission to role');
  }
};

export const removePermissionFromRoleService = async (roleId: number, permissionId: number) => {
  const role = await getRoleById(roleId);

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  // Check if it's a protected role with critical permissions
  if (!validateNotProtectedRole(role.name)) {
    // Add logic here to prevent removing critical permissions from admin role
    // For example, prevent removing 'manage_users' from admin role
  }

  try {
    const removed = await removePermissionFromRole(roleId, permissionId);

    if (!removed) {
      throw new NotFoundError('Permission not assigned to this role');
    }

    return await getRoleWithPermissions(roleId);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new CustomAPIError('Failed to remove permission from role', 500);
  }
};

export const getRoleUsersService = async (roleId: number, params: GetRoleUsersRequest) => {
  const role = await getRoleById(roleId);

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  try {
    return await getRoleUsers(roleId, params);
  } catch {
    throw new CustomAPIError('Failed to fetch role users');
  }
};

// Helper service to get all available permissions for role assignment
export const getAllPermissionsService = async () => {
  try {
    const allPermissions = await db
      .select({
        id: permissions.id,
        name: permissions.name,
        description: permissions.description,
      })
      .from(permissions);

    return allPermissions;
  } catch {
    throw new CustomAPIError('Failed to fetch permissions');
  }
};

// Helper service to validate role operations
export const validateRoleOperation = (roleName: string, operation: string): void => {
  if (!validateNotProtectedRole(roleName)) {
    switch (operation) {
      case 'delete':
        throw new BadRequestError('Cannot delete protected role');
      case 'modify_critical':
        throw new BadRequestError('Cannot modify critical properties of protected role');
      default:
        break;
    }
  }
};
