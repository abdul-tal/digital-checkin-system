import { Response } from 'express';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, any>
) => {
  res.status(statusCode).json({
    data,
    ...(meta && { meta }),
  });
};

export const sendError = (
  res: Response,
  code: string,
  message: string,
  statusCode = 500,
  details?: any
) => {
  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(details && { details }),
    },
  });
};
