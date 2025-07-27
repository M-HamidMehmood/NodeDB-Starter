import { NextFunction, Request, Response } from 'express';
import { env } from '../../../config/config';
import { createJWT } from '../../utils/jwt';
import { sendSuccess } from '../../utils/responseHandler';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.schema';
import * as authService from './auth.service';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);
    await authService.register(validatedData);
    sendSuccess(res, null, 'Success! Please check your email to verify account', 201);
  } catch (err) {
    next(err);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = verifyEmailSchema.parse(req.body);
    await authService.verifyEmail(validatedData);
    sendSuccess(res, null, 'Email verified successfully.');
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { user, permissionNames } = await authService.login(validatedData);

    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      permissions: permissionNames,
    };

    const token = createJWT(payload);

    res.cookie('token', token, {
      httpOnly: true,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    sendSuccess(
      res,
      {
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
      },
      'Login successful.'
    );
  } catch (err) {
    next(err);
  }
};

export const logout = (_req: Request, res: Response, next: NextFunction): void => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.cookie('token', 'logout', {
      httpOnly: true,
      expires: new Date(0),
    });

    sendSuccess(res, null, 'Logout successful.');
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = forgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(validatedData.email);
    sendSuccess(res, null, 'Please check your email for reset password link.');
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, email, password } = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(token, email, password);
    sendSuccess(res, null, 'Password has been reset.');
  } catch (err) {
    next(err);
  }
};
