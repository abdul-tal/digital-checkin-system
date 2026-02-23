import { Redis } from 'ioredis';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('blocking-service');

export interface BlockRequest {
  identifier: string;
  reason: string;
  duration: number;
  metadata?: Record<string, any>;
}

export class BlockingService {
  constructor(private redis: Redis) {}

  async block(req: BlockRequest): Promise<void> {
    const key = `blocked:${req.identifier}`;

    await this.redis.setex(
      key,
      req.duration,
      JSON.stringify({
        reason: req.reason,
        blockedAt: new Date().toISOString(),
        metadata: req.metadata,
      })
    );

    logger.info('Identifier blocked', {
      identifier: req.identifier,
      reason: req.reason,
      duration: req.duration,
    });
  }

  async isBlocked(identifier: string): Promise<boolean> {
    const key = `blocked:${identifier}`;
    const blocked = await this.redis.get(key);
    return !!blocked;
  }

  async unblock(identifier: string): Promise<void> {
    const key = `blocked:${identifier}`;
    await this.redis.del(key);
    logger.info('Identifier unblocked', { identifier });
  }

  async requireCaptcha(userId: string): Promise<void> {
    const key = `captcha_required:${userId}`;
    await this.redis.setex(key, 3600, 'true');
    logger.info('CAPTCHA required for user', { userId });
  }

  async requiresCaptcha(userId: string): Promise<boolean> {
    const key = `captcha_required:${userId}`;
    const required = await this.redis.get(key);
    return !!required;
  }

  async clearCaptcha(userId: string): Promise<void> {
    const key = `captcha_required:${userId}`;
    await this.redis.del(key);
    logger.info('CAPTCHA requirement cleared', { userId });
  }
}
