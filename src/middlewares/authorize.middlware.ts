import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../types/express';

type AuthorizeMiddleware = (
  permissions: string[]
) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;

const authorizeMiddleware: AuthorizeMiddleware =
  (permissions: string[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userPermissions = req.user?.permissions || [];

    // Check if user has any of the required permissions
    const hasPermission = permissions.some(permission => userPermissions.includes(permission));

    if (hasPermission) {
      next();
    } else {
      res.status(403).json({
        success: false,
        message: "You don't have the permission to access this resource!",
      });
    }
  };

export default authorizeMiddleware;
