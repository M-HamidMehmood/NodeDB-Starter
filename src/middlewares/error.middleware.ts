import { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/config';
import { logger } from '../utils';

type ErrorResponse = {
  success: boolean;
  message: string;
  errors?: Array<{ field: string; message: string }>;
  stack?: string;
};

interface CustomError extends Error {
  statusCode?: number;
  status?: number;
}

const errorMiddleware = (err: CustomError, req: Request, res: Response): void => {
  logger.error(`${req.method} ${req.url} - ${err.message}`, {
    stack: err.stack,
  });

  // Handle Zod validation errors
  if (err instanceof z.ZodError) {
    const formattedErrors = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors,
    } as ErrorResponse);
    return;
  }

  const status = err.statusCode || err.status || 500;
  const response: ErrorResponse = {
    success: false,
    message: err.message || 'Internal Server Error',
  };

  if (env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(status).json(response);
};

export default errorMiddleware;
