import { Request, Response, NextFunction } from 'express';
import { AppError, SeatUnavailableError } from '../errors/app-error';
import { createLogger } from '../utils/logger';

const logger = createLogger('error-handler');

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof SeatUnavailableError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        suggestions: err.suggestions,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
  }

  // Unexpected errors
  logger.error('Unexpected error', {
    error: err,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown',
    },
  });
};
