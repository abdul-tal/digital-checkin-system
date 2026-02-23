import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('rate-limiter');

// Create a singleton Redis client for rate limiting with offline queue enabled
let redisClient: Redis | null = null;

const getRateLimiterRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableOfflineQueue: true, // Allow queuing commands while connecting
      maxRetriesPerRequest: 3,
    });

    redisClient.on('connect', () => {
      logger.info('Rate limiter Redis connected');
    });

    redisClient.on('error', (err) => {
      logger.error('Rate limiter Redis error', { error: err.message });
    });
  }
  
  return redisClient;
};

export const createRateLimiter = (
  windowMs: number,
  max: number,
  keyPrefix = 'global'
) => {
  const client = getRateLimiterRedisClient();
  
  return rateLimit({
    store: new RedisStore({
      sendCommand: async (...args: any[]): Promise<any> => {
        return client.call(args[0], ...args.slice(1));
      },
      prefix: `rate_limit:${keyPrefix}:`,
    }) as any,
    windowMs,
    max,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Please try again in ${Math.ceil(windowMs / 1000)} seconds.`,
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const user = (req as any).user;
      return user?.userId || req.ip;
    },
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        userId: (req as any).user?.userId,
        ip: req.ip,
        path: req.path,
      });

      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(windowMs / 1000),
        },
      });
    },
  });
};
