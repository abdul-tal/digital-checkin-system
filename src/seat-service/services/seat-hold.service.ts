import mongoose from 'mongoose';
import { SeatRepository } from '../repositories/seat.repository';
import { SeatCacheService } from './seat-cache.service';
import { SeatPublisher } from '../events/publishers/seat.publisher';
import { SeatUnavailableError, AppError } from '../../shared/errors/app-error';
import { SeatState } from '../../shared/types/common.types';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('seat-hold-service');

export interface HoldSeatRequest {
  flightId: string;
  seatId: string;
  passengerId: string;
  duration?: number;
}

export interface HoldSeatResponse {
  holdId: string;
  seatId: string;
  expiresAt: Date;
  remainingSeconds: number;
}

export class SeatHoldService {
  constructor(
    private seatRepository: SeatRepository,
    private cacheService: SeatCacheService,
    private eventPublisher: SeatPublisher
  ) {}

  async holdSeat(req: HoldSeatRequest): Promise<HoldSeatResponse> {
    const session = await mongoose.startSession();
    const duration = req.duration || parseInt(process.env.SEAT_HOLD_DURATION_SECONDS || '120');
    const expiresAt = new Date(Date.now() + duration * 1000);

    try {
      const result = await session.withTransaction(async () => {
        // Attempt atomic seat hold (prevents race conditions)
        const seat = await this.seatRepository.findOneAndUpdate(
          {
            seatId: req.seatId,
            flightId: req.flightId,
            state: SeatState.AVAILABLE,
          },
          {
            $set: {
              state: SeatState.HELD,
              heldByPassengerId: req.passengerId,
              holdExpiresAt: expiresAt,
              updatedAt: new Date(),
            },
          },
          {
            returnDocument: 'after',
            session,
          }
        );

        // Seat not available - find alternatives
        if (!seat) {
          const alternatives = await this.findAlternativeSeats(
            req.flightId,
            req.seatId,
            session
          );
          throw new SeatUnavailableError(alternatives);
        }

        logger.info('Seat held successfully', {
          seatId: req.seatId,
          passengerId: req.passengerId,
          expiresAt,
        });

        return seat;
      });

      // Invalidate cache (outside transaction)
      await this.cacheService.invalidateSeatMap(req.flightId);

      // Publish event (outside transaction)
      await this.eventPublisher.publish('seat.held', {
        seatId: req.seatId,
        flightId: req.flightId,
        passengerId: req.passengerId,
        expiresAt,
      });

      return {
        holdId: result._id.toString(),
        seatId: result.seatId,
        expiresAt: result.holdExpiresAt!,
        remainingSeconds: duration,
      };
    } finally {
      await session.endSession();
    }
  }

  async releaseSeat(seatId: string, flightId: string): Promise<void> {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const seat = await this.seatRepository.findOneAndUpdate(
          { seatId, flightId, state: { $in: [SeatState.HELD, SeatState.CONFIRMED] } },
          {
            $set: {
              state: SeatState.AVAILABLE,
              heldByPassengerId: null,
              holdExpiresAt: null,
              confirmedByPassengerId: null,
              updatedAt: new Date(),
            },
          },
          { returnDocument: 'after', session }
        );

        if (!seat) {
          throw new Error('Seat not found or already released');
        }

        logger.info('Seat released', { seatId, flightId });
      });

      await this.cacheService.invalidateSeatMap(flightId);
      await this.eventPublisher.publish('seat.released', { seatId, flightId });
    } finally {
      await session.endSession();
    }
  }

  async confirmSeat(seatId: string, flightId: string, passengerId: string): Promise<void> {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const seatCheck = await this.seatRepository.findOne(
          { seatId, flightId },
          session
        );

        if (!seatCheck) {
          throw new AppError(404, 'SEAT_NOT_FOUND', `Seat ${seatId} not found`);
        }

        if (seatCheck.state !== SeatState.HELD) {
          logger.error('Cannot confirm seat - not in HELD state', {
            seatId,
            currentState: seatCheck.state,
            passengerId,
          });
          throw new AppError(
            409,
            'SEAT_NOT_HELD',
            `Seat ${seatId} is ${seatCheck.state}, cannot confirm. It may have expired or been released.`
          );
        }

        if (seatCheck.heldByPassengerId !== passengerId) {
          throw new AppError(
            403,
            'SEAT_HELD_BY_OTHER',
            `Seat ${seatId} is held by another passenger`
          );
        }

        const seat = await this.seatRepository.findOneAndUpdate(
          {
            seatId,
            flightId,
            state: SeatState.HELD,
            heldByPassengerId: passengerId,
          },
          {
            $set: {
              state: SeatState.CONFIRMED,
              confirmedByPassengerId: passengerId,
              holdExpiresAt: null,
              updatedAt: new Date(),
            },
          },
          { returnDocument: 'after', session }
        );

        if (!seat) {
          throw new AppError(
            409,
            'SEAT_CONFIRMATION_FAILED',
            'Failed to confirm seat due to concurrent modification'
          );
        }

        logger.info('Seat confirmed', { seatId, flightId, passengerId });
      });

      await this.cacheService.invalidateSeatMap(flightId);
      await this.eventPublisher.publish('seat.confirmed', {
        seatId,
        flightId,
        passengerId,
      });
    } finally {
      await session.endSession();
    }
  }

  private async findAlternativeSeats(
    flightId: string,
    originalSeatId: string,
    session: mongoose.ClientSession
  ): Promise<string[]> {
    const [rowStr, column] = [originalSeatId.slice(0, -1), originalSeatId.slice(-1)];
    const row = parseInt(rowStr);

    // Determine seat type preference
    const seatType =
      column === 'A' || column === 'F'
        ? 'WINDOW'
        : column === 'C' || column === 'D'
          ? 'AISLE'
          : 'MIDDLE';

    // Find 3 similar available seats (same type, nearby row)
    const alternatives = await this.seatRepository.find(
      {
        flightId,
        state: SeatState.AVAILABLE,
        seatType,
        rowNumber: { $gte: row - 2, $lte: row + 2 },
      },
      { limit: 3, sort: { rowNumber: 1 }, session }
    );

    return alternatives.map((s) => s.seatId);
  }
}
