import { NextFunction, Response } from 'express';
import CustomError from '../../errors';
import { verifyJWT } from '../utils/jwt';
import { AuthenticatedRequest } from '../types/express';

const authenticateMiddleware = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const token = req.signedCookies?.token as string;

  if (!token) {
    throw new CustomError.UnauthenticatedError('Authentication Invalid');
  }

  try {
    const payload = verifyJWT(token);
    req.user = {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      permissions: payload.permissions,
    };
    next();
  } catch {
    throw new CustomError.UnauthenticatedError('Authentication Invalid');
  }
};

export default authenticateMiddleware;
