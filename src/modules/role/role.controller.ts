import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/responseHandler';
import {
  assignPermissionsSchema,
  createRoleSchema,
  getRolesQuerySchema,
  getRoleUsersQuerySchema,
  permissionIdParamSchema,
  roleIdParamSchema,
  updateRoleSchema,
} from './role.schema';
import * as roleService from './role.service';

export const createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = createRoleSchema.parse(req.body);
    const role = await roleService.createRoleService(validatedData);
    sendSuccess(res, role, 'Role created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const getAllRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedQuery = getRolesQuerySchema.parse(req.query);
    const result = await roleService.getAllRolesService(validatedQuery);

    sendSuccess(
      res,
      {
        roles: result.roles,
        pagination: {
          totalRoles: result.totalRoles,
          totalPages: result.totalPages,
          currentPage: result.currentPage,
          hasNextPage: result.currentPage < result.totalPages,
          hasPrevPage: result.currentPage > 1,
        },
      },
      'Roles retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

export const getRoleById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = roleIdParamSchema.parse(req.params);
    const role = await roleService.getRoleByIdService(id);
    sendSuccess(res, role, 'Role retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = roleIdParamSchema.parse(req.params);
    const validatedData = updateRoleSchema.parse(req.body);
    const role = await roleService.updateRoleService(id, validatedData);
    sendSuccess(res, role, 'Role updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = roleIdParamSchema.parse(req.params);
    await roleService.deleteRoleService(id);
    sendSuccess(res, null, 'Role deleted successfully');
  } catch (err) {
    next(err);
  }
};

export const assignPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = roleIdParamSchema.parse(req.params);
    const validatedData = assignPermissionsSchema.parse(req.body);
    const role = await roleService.assignPermissionsToRoleService(id, validatedData);
    sendSuccess(res, role, 'Permissions assigned successfully');
  } catch (err) {
    next(err);
  }
};

export const removePermission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = roleIdParamSchema.parse(req.params);
    const { permissionId } = permissionIdParamSchema.parse(req.params);
    const role = await roleService.removePermissionFromRoleService(id, permissionId);
    sendSuccess(res, role, 'Permission removed successfully');
  } catch (err) {
    next(err);
  }
};

export const getRoleUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = roleIdParamSchema.parse(req.params);
    const validatedQuery = getRoleUsersQuerySchema.parse(req.query);
    const result = await roleService.getRoleUsersService(id, validatedQuery);

    sendSuccess(
      res,
      {
        users: result.users,
        pagination: {
          totalUsers: result.totalUsers,
          totalPages: result.totalPages,
          currentPage: result.currentPage,
          hasNextPage: result.currentPage < result.totalPages,
          hasPrevPage: result.currentPage > 1,
        },
      },
      'Role users retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

export const getAllPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const permissions = await roleService.getAllPermissionsService();
    sendSuccess(res, permissions, 'Permissions retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// Utility endpoint for role statistics
export const getRoleStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = roleIdParamSchema.parse(req.params);
    const role = await roleService.getRoleByIdService(id);
    const users = await roleService.getRoleUsersService(id, { page: 1, limit: 1 });

    const stats = {
      roleId: role.id,
      roleName: role.name,
      userCount: users.totalUsers,
      permissionCount: role.permissions.length,
      permissions: role.permissions.map(p => p.name),
    };

    sendSuccess(res, stats, 'Role statistics retrieved successfully');
  } catch (err) {
    next(err);
  }
};
