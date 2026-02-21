import { Redis } from 'ioredis';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('seat-cache-service');

export class SeatCacheService {
  private readonly CACHE_TTL = parseInt(process.env.CACHE_SEATMAP_TTL_SECONDS || '5');
  private readonly CACHE_PREFIX = 'seatmap';

  constructor(private redis: Redis) {}

  async getSeatMap(flightId: string): Promise<any | null> {
    const key = `${this.CACHE_PREFIX}:${flightId}`;
    const cached = await this.redis.get(key);

    if (cached) {
      logger.debug('Cache hit', { flightId });
      return JSON.parse(cached);
    }

    logger.debug('Cache miss', { flightId });
    return null;
  }

  async setSeatMap(flightId: string, seatMap: any): Promise<void> {
    const key = `${this.CACHE_PREFIX}:${flightId}`;
    await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(seatMap));
    logger.debug('Cache set', { flightId, ttl: this.CACHE_TTL });
  }

  async invalidateSeatMap(flightId: string): Promise<void> {
    const key = `${this.CACHE_PREFIX}:${flightId}`;
    await this.redis.del(key);
    logger.debug('Cache invalidated', { flightId });
  }
}
