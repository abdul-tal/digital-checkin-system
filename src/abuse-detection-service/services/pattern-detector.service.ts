import { Redis } from 'ioredis';
import { BlockingService } from './blocking.service';
import { AuditLoggerService } from './audit-logger.service';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('pattern-detector');

export interface CheckAccessRequest {
  userId?: string;
  ip: string;
  action: 'SEAT_MAP_ACCESS' | 'HOLD_SEAT';
}

export class PatternDetectorService {
  private readonly RAPID_SEAT_MAP_THRESHOLD = 50;
  private readonly SEAT_MAP_WINDOW_MS = 2000;
  
  private readonly HOLD_SPAM_THRESHOLD = 10;
  private readonly HOLD_SPAM_WINDOW_MS = 300000;

  constructor(
    private redis: Redis,
    private blockingService: BlockingService,
    private auditLogger: AuditLoggerService
  ) {}

  async checkRapidSeatMapAccess(req: CheckAccessRequest): Promise<boolean> {
    const identifier = req.userId || req.ip;
    const key = `seatmap_access:${identifier}`;

    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.pexpire(key, this.SEAT_MAP_WINDOW_MS);
    }

    logger.debug('Seat map access tracked', { identifier, count });

    if (count > this.RAPID_SEAT_MAP_THRESHOLD) {
      await this.blockingService.block({
        identifier,
        reason: 'RAPID_SEAT_MAP_ACCESS',
        duration: 300,
        metadata: { count, threshold: this.RAPID_SEAT_MAP_THRESHOLD },
      });

      await this.auditLogger.log({
        identifier,
        action: 'BLOCKED',
        reason: 'Rapid seat map access detected',
        metadata: { count, threshold: this.RAPID_SEAT_MAP_THRESHOLD },
      });

      logger.warn('Rapid seat map access detected - BLOCKED', {
        identifier,
        count,
        threshold: this.RAPID_SEAT_MAP_THRESHOLD,
      });

      return true;
    }

    return false;
  }

  async checkHoldSpam(userId: string): Promise<boolean> {
    const key = `hold_spam:${userId}`;

    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.pexpire(key, this.HOLD_SPAM_WINDOW_MS);
    }

    logger.debug('Hold attempt tracked', { userId, count });

    if (count > this.HOLD_SPAM_THRESHOLD) {
      await this.blockingService.requireCaptcha(userId);

      await this.auditLogger.log({
        identifier: userId,
        action: 'CAPTCHA_REQUIRED',
        reason: 'Rapid hold/release detected',
        metadata: { count, threshold: this.HOLD_SPAM_THRESHOLD },
      });

      logger.warn('Rapid hold/release detected - CAPTCHA required', {
        userId,
        count,
      });

      return true;
    }

    return false;
  }

  async isBlocked(identifier: string): Promise<boolean> {
    return this.blockingService.isBlocked(identifier);
  }

  async requiresCaptcha(userId: string): Promise<boolean> {
    return this.blockingService.requiresCaptcha(userId);
  }
}
