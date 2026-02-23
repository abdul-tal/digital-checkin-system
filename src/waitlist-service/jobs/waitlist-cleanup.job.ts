import { WaitlistRepository } from '../repositories/waitlist.repository';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('waitlist-cleanup-job');

export class WaitlistCleanupJob {
  private intervalId?: NodeJS.Timeout;
  private readonly INTERVAL_MS = 60000;

  constructor(private waitlistRepository: WaitlistRepository) {}

  start(): void {
    logger.info('Starting waitlist cleanup job', { intervalMs: this.INTERVAL_MS });

    this.intervalId = setInterval(() => {
      this.cleanupExpiredEntries().catch((error) => {
        logger.error('Error in waitlist cleanup job', { error });
      });
    }, this.INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      logger.info('Waitlist cleanup job stopped');
    }
  }

  async cleanupExpiredEntries(): Promise<void> {
    const deletedCount = await this.waitlistRepository.deleteExpired();

    if (deletedCount > 0) {
      logger.info('Expired waitlist entries cleaned up', { count: deletedCount });
    }
  }
}
