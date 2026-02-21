import mongoose from 'mongoose';
import { SeatRepository } from '../repositories/seat.repository';
import { SeatCacheService } from '../services/seat-cache.service';
import { SeatPublisher } from '../events/publishers/seat.publisher';
import { SeatState } from '../../shared/types/common.types';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('hold-expiration-job');

export class HoldExpirationJob {
  private intervalId?: NodeJS.Timeout;
  private readonly INTERVAL_MS = 10000; // 10 seconds

  constructor(
    private seatRepository: SeatRepository,
    private cacheService: SeatCacheService,
    private eventPublisher: SeatPublisher
  ) {}

  start(): void {
    logger.info('Starting hold expiration job', { intervalMs: this.INTERVAL_MS });

    this.intervalId = setInterval(() => {
      this.processExpiredHolds().catch((error) => {
        logger.error('Error in hold expiration job', { error });
      });
    }, this.INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      logger.info('Hold expiration job stopped');
    }
  }

  async processExpiredHolds(): Promise<void> {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Find all expired holds
        const expiredSeats = await this.seatRepository.find({
          state: SeatState.HELD,
          holdExpiresAt: { $lte: new Date() },
        });

        if (expiredSeats.length === 0) {
          return;
        }

        logger.info(`Processing ${expiredSeats.length} expired holds`);

        // Release all expired holds
        for (const seat of expiredSeats) {
          await this.seatRepository.findOneAndUpdate(
            { _id: seat._id },
            {
              $set: {
                state: SeatState.AVAILABLE,
                heldByPassengerId: null,
                holdExpiresAt: null,
                updatedAt: new Date(),
              },
            },
            { returnDocument: 'after', session }
          );

          // Invalidate cache
          await this.cacheService.invalidateSeatMap(seat.flightId);

          // Publish event for waitlist processing
          await this.eventPublisher.publish('seat.hold.expired', {
            seatId: seat.seatId,
            flightId: seat.flightId,
            previousHolder: seat.heldByPassengerId,
          });

          logger.info('Seat hold expired and released', {
            seatId: seat.seatId,
            flightId: seat.flightId,
            previousHolder: seat.heldByPassengerId,
          });
        }
      });
    } catch (error) {
      logger.error('Error processing expired holds', { error });
    } finally {
      await session.endSession();
    }
  }
}
