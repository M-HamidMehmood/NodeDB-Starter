import { Response } from 'express';

export type APIResponse<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Record<string, string>;
};

export const sendSuccess = <T>(res: Response, data?: T, message?: string, statusCode = 200): Response =>
  res.status(statusCode).json({
    success: true,
    message,
    data,
  } as APIResponse<T>);

export const sendError = (res: Response, error: string, errors?: Record<string, string>, statusCode = 500): Response =>
  res.status(statusCode).json({
    success: false,
    error,
    errors,
  } as APIResponse);

export const sendValidationError = (res: Response, errors: Record<string, string>): Response =>
  res.status(400).json({
    success: false,
    error: 'Validation failed',
    errors,
  } as APIResponse);
