import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { createLogger } from '../utils/logger';

const logger = createLogger('http');

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || uuid();
  req.headers['x-request-id'] = requestId;

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('HTTP Request', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
};
