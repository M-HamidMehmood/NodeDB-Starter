import jwt from 'jsonwebtoken';
import { env } from '../../config/config';

export type JWTPayload = {
  userId: number;
  email: string;
  name: string;
  roleId: number;
  permissions: string[];
};

export const createJWT = (payload: JWTPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_LIFETIME,
  } as jwt.SignOptions);

export const verifyJWT = (token: string): JWTPayload => jwt.verify(token, env.JWT_SECRET) as JWTPayload;

export const isTokenValid = (token: string): boolean => {
  try {
    jwt.verify(token, env.JWT_SECRET);
    return true;
  } catch {
    return false;
  }
};
