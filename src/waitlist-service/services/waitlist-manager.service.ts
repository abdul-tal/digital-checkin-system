import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import { WaitlistRepository } from '../repositories/waitlist.repository';
import { PriorityCalculatorService } from './priority-calculator.service';
import { CheckInServiceClient } from '../clients/checkin-service.client';
import { NotificationServiceClient } from '../clients/notification-service.client';
import { WaitlistPublisher } from '../events/publishers/waitlist.publisher';
import { LoyaltyTier } from '../../shared/types/common.types';
import { createLogger } from '../../shared/utils/logger';
import { AppError } from '../../shared/errors/app-error';

const logger = createLogger('waitlist-manager');

export interface JoinWaitlistRequest {
  passengerId: string;
  checkInId: string;
  userId: string;
  flightId: string;
  seatId: string;
  loyaltyTier: LoyaltyTier;
  bookingTimestamp: Date;
  hasSpecialNeeds?: boolean;
  baggage?: {
    count: number;
    weights?: number[];
  };
}

export interface WaitlistResponse {
  waitlistId: string;
  position: number;
  estimatedWaitTime: string;
}

export class WaitlistManagerService {
  constructor(
    private waitlistRepository: WaitlistRepository,
    private priorityCalculator: PriorityCalculatorService,
    private checkinClient: CheckInServiceClient,
    private notificationClient: NotificationServiceClient,
    private eventPublisher: WaitlistPublisher
  ) {}

  async joinWaitlist(req: JoinWaitlistRequest): Promise<WaitlistResponse> {
    const existing = await this.waitlistRepository.findOne({
      passengerId: req.passengerId,
      flightId: req.flightId,
      seatId: req.seatId,
    });

    if (existing) {
      throw new AppError(
        409,
        'ALREADY_ON_WAITLIST',
        'You are already on the waitlist for this seat'
      );
    }

    const priorityScore = this.priorityCalculator.calculate({
      loyaltyTier: req.loyaltyTier,
      bookingTimestamp: req.bookingTimestamp,
      hasSpecialNeeds: req.hasSpecialNeeds,
    });

    const waitlistId = `wl_${uuid()}`;
    const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000);

    await this.waitlistRepository.create({
      waitlistId,
      passengerId: req.passengerId,
      checkInId: req.checkInId,
      flightId: req.flightId,
      seatId: req.seatId,
      priorityScore,
      loyaltyTier: req.loyaltyTier,
      baggage: req.baggage || { count: 0 },
      expiresAt,
      createdAt: new Date(),
    });

    const position = await this.getWaitlistPosition(waitlistId);

    logger.info('Passenger joined waitlist', {
      waitlistId,
      passengerId: req.passengerId,
      seatId: req.seatId,
      position,
      priorityScore,
    });

    await this.eventPublisher.publish('waitlist.joined', {
      waitlistId,
      passengerId: req.passengerId,
      seatId: req.seatId,
      position,
    });

    return {
      waitlistId,
      position,
      estimatedWaitTime: this.priorityCalculator.estimateWaitTime(position),
    };
  }

  async leaveWaitlist(waitlistId: string, passengerId: string): Promise<void> {
    const waitlist = await this.waitlistRepository.findOne({ waitlistId });

    if (!waitlist) {
      throw new AppError(404, 'WAITLIST_NOT_FOUND', 'Waitlist entry not found');
    }

    if (waitlist.passengerId !== passengerId) {
      throw new AppError(403, 'FORBIDDEN', 'Passenger mismatch');
    }

    await this.waitlistRepository.deleteOne({ waitlistId });

    logger.info('Passenger left waitlist', { waitlistId, passengerId });

    await this.eventPublisher.publish('waitlist.left', {
      waitlistId,
      passengerId,
    });
  }

  private async getWaitlistPosition(waitlistId: string): Promise<number> {
    const entry = await this.waitlistRepository.findOne({ waitlistId });

    if (!entry) {
      throw new AppError(404, 'WAITLIST_NOT_FOUND', 'Waitlist entry not found');
    }

    const higherPriorityCount = await this.waitlistRepository.countDocuments({
      seatId: entry.seatId,
      flightId: entry.flightId,
      priorityScore: { $gt: entry.priorityScore },
    });

    return higherPriorityCount + 1;
  }

  async processSeatAvailable(seatId: string, flightId: string): Promise<void> {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const waitlist = await this.waitlistRepository.findOne(
          { seatId, flightId },
          { sort: { priorityScore: -1 }, session }
        );

        if (!waitlist) {
          logger.info('No waitlist entries for seat', { seatId, flightId });
          return;
        }

        logger.info('Processing waitlist assignment', {
          waitlistId: waitlist.waitlistId,
          passengerId: waitlist.passengerId,
          seatId,
          priorityScore: waitlist.priorityScore,
        });

        try {
          // Auto-complete check-in for waitlisted passenger
          const completedCheckIn = await this.checkinClient.completeCheckIn({
            checkInId: waitlist.checkInId,
            passengerId: waitlist.passengerId,
            userId: `U_${waitlist.passengerId}`,
            seatId,
            baggage: waitlist.baggage || { count: 0 },
          });

          await this.waitlistRepository.deleteOne(
            { waitlistId: waitlist.waitlistId },
            session
          );

          // Send notification with boarding pass
          await this.notificationClient.send({
            passengerId: waitlist.passengerId,
            type: 'WAITLIST_CHECKIN_COMPLETED',
            channels: ['push', 'email', 'sms'],
            data: {
              seatId,
              flightId,
              boardingPass: completedCheckIn.boardingPass,
              state: completedCheckIn.state,
            },
          });

          await this.eventPublisher.publish('waitlist.checkin.completed', {
            waitlistId: waitlist.waitlistId,
            checkInId: waitlist.checkInId,
            passengerId: waitlist.passengerId,
            seatId,
            flightId,
            boardingPass: completedCheckIn.boardingPass,
          });

          logger.info('Waitlist check-in auto-completed', {
            waitlistId: waitlist.waitlistId,
            checkInId: waitlist.checkInId,
            passengerId: waitlist.passengerId,
            seatId,
            state: completedCheckIn.state,
          });
        } catch (error: any) {
          logger.error('Failed to auto-complete check-in from waitlist', {
            error: error.message,
            waitlistId: waitlist.waitlistId,
            checkInId: waitlist.checkInId,
          });
          
          // If check-in completion failed, try next person in waitlist
          await this.waitlistRepository.deleteOne(
            { waitlistId: waitlist.waitlistId },
            session
          );
          await this.processSeatAvailable(seatId, flightId);
        }
      });
    } catch (error) {
      logger.error('Error processing waitlist', { error, seatId, flightId });
    } finally {
      await session.endSession();
    }
  }
}
