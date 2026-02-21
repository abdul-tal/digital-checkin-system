import Redis from 'ioredis';
import { createLogger } from '../utils/logger';

const logger = createLogger('redis');

export const createRedisClient = (): Redis => {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    enableOfflineQueue: false,
    maxRetriesPerRequest: 3,
  });

  redis.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  redis.on('error', (err) => {
    logger.error('Redis connection error', { error: err });
  });

  redis.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return redis;
};

export const createPubSubClients = () => {
  return {
    publisher: createRedisClient(),
    subscriber: createRedisClient(),
  };
};
