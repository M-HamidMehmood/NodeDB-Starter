import { NextFunction, Response } from 'express';
import CustomError from '../../../errors';
import { createJWT } from '../../utils/jwt';
import { sendSuccess } from '../../utils/responseHandler';
import { getUsersQuerySchema, updatePasswordSchema, updateUserSchema, userIdSchema } from './user.schema';
import * as userService from './user.service';
import { AuthenticatedRequest } from '../../types/express';

export const getAllUsers = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queryParams = getUsersQuerySchema.parse(req.query);
    const users = await userService.getAllUsersService(queryParams);
    sendSuccess(res, users);
  } catch (err) {
    next(err);
  }
};

export const getSingleUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = userIdSchema.parse({ id: req.params.id });
    const user = await userService.getUserByIdService(id);

    if (!user) {
      throw new CustomError.NotFoundError(`No user with id: ${id}`);
    }

    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

export const showCurrentUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await userService.getUserByIdService(req.user.id);

    if (!user) {
      throw new CustomError.NotFoundError('User not found');
    }

    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate ID parameter
    const { id } = userIdSchema.parse({ id: req.params.id });

    // Validate request body
    const rawUpdateData = updateUserSchema.parse(req.body);

    // Filter out undefined values for exactOptionalPropertyTypes
    const updateData = Object.fromEntries(
      Object.entries(rawUpdateData).filter(([, value]) => value !== undefined)
    ) as Partial<{ name: string; email: string }>;

    if (id !== req.user.id && !req.user.permissions.includes('manage_users')) {
      throw new CustomError.UnauthorizedError('You are not allowed to update this user');
    }

    const user = await userService.updateUserService(id, updateData);

    if (id === req.user.id) {
      const tokenUser = {
        userId: user.id,
        email: user.email,
        name: user.name,
        roleId: user.roleId,
        permissions: req.user.permissions,
      };

      const token = createJWT(tokenUser);

      res.cookie('token', token, {
        httpOnly: true,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
    }

    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

export const updateUserPassword = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    updatePasswordSchema.parse(req.body);
    // TODO: Implementation would need to be added to user service
    // await userService.updatePassword(userId, oldPassword, newPassword);

    sendSuccess(res, null, 'Password updated successfully');
  } catch (err) {
    next(err);
  }
};
