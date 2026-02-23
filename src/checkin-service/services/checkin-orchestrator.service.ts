import { v4 as uuid } from 'uuid';
import { CheckInRepository } from '../repositories/checkin.repository';
import { BaggageValidatorService } from './baggage-validator.service';
import { BoardingPassService } from './boarding-pass.service';
import { SeatServiceClient } from '../clients/seat-service.client';
import { PaymentServiceClient } from '../clients/payment-service.client';
import { CheckInPublisher } from '../events/publishers/checkin.publisher';
import { CheckInState } from '../../shared/types/common.types';
import { createLogger } from '../../shared/utils/logger';
import { AppError } from '../../shared/errors/app-error';

const logger = createLogger('checkin-orchestrator');

export interface StartCheckInRequest {
  passengerId: string;
  userId: string;
  bookingId: string;
}

export interface CompleteCheckInRequest {
  checkInId: string;
  passengerId: string;
  userId: string;
  seatId: string;
  baggage: {
    count: number;
    weights?: number[];
  };
}

export class CheckInOrchestratorService {
  constructor(
    private checkinRepository: CheckInRepository,
    private baggageValidator: BaggageValidatorService,
    private boardingPassService: BoardingPassService,
    private seatClient: SeatServiceClient,
    private paymentClient: PaymentServiceClient,
    private eventPublisher: CheckInPublisher
  ) {}

  async startCheckIn(req: StartCheckInRequest) {
    const flightId = 'SK123';

    const checkInId = `ci_${uuid()}`;

    const checkin = await this.checkinRepository.create({
      checkInId,
      userId: req.userId,
      passengerId: req.passengerId,
      flightId,
      state: CheckInState.IN_PROGRESS,
      createdAt: new Date(),
    });

    logger.info('Check-in started', { checkInId, passengerId: req.passengerId });

    return {
      checkInId: checkin.checkInId,
      state: CheckInState.IN_PROGRESS,
      flightId,
    };
  }

  async completeCheckIn(req: CompleteCheckInRequest) {
    const checkin = await this.checkinRepository.findById(req.checkInId);

    if (!checkin) {
      throw new AppError(404, 'CHECKIN_NOT_FOUND', 'Check-in not found');
    }

    if (checkin.passengerId !== req.passengerId) {
      throw new AppError(403, 'FORBIDDEN', 'Passenger mismatch');
    }

    try {
      await this.seatClient.holdSeat({
        flightId: checkin.flightId,
        seatId: req.seatId,
        passengerId: req.passengerId,
      });

      await this.checkinRepository.updateOne(
        { checkInId: req.checkInId },
        { $set: { seatId: req.seatId } }
      );
      
      // Update the checkin object with the seatId
      checkin.seatId = req.seatId;
    } catch (error: any) {
      logger.error('Failed to hold seat', { error });
      throw new AppError(409, 'SEAT_UNAVAILABLE', 'Failed to hold seat');
    }

    const baggageValidation = await this.baggageValidator.validate(
      req.baggage.count,
      req.baggage.weights
    );

    if (!baggageValidation.valid) {
      await this.seatClient.releaseSeat(req.seatId, checkin.flightId);
      throw new AppError(
        400,
        'BAGGAGE_TOO_HEAVY',
        'One or more bags exceed the maximum weight limit'
      );
    }

    if (baggageValidation.totalFee > 0) {
      const payment = await this.paymentClient.initiatePayment({
        amount: baggageValidation.totalFee,
        passengerId: req.passengerId,
        checkInId: req.checkInId,
      });

      await this.checkinRepository.updateOne(
        { checkInId: req.checkInId },
        {
          $set: {
            state: CheckInState.AWAITING_PAYMENT,
            'baggage.count': req.baggage.count,
            'baggage.weights': baggageValidation.bags.map((b) => b.weight),
            'baggage.fee': baggageValidation.totalFee,
            paymentUrl: payment.paymentUrl,
          },
        }
      );

      logger.info('Check-in awaiting payment', {
        checkInId: req.checkInId,
        fee: baggageValidation.totalFee,
      });

      return {
        checkInId: req.checkInId,
        state: CheckInState.AWAITING_PAYMENT,
        baggageFee: baggageValidation.totalFee,
        paymentUrl: payment.paymentUrl,
        expiresAt: payment.expiresAt,
      };
    }

    return this.finalizeCheckIn(checkin, baggageValidation);
  }

  private async finalizeCheckIn(checkin: any, baggageValidation: any) {
    await this.seatClient.confirmSeat(
      checkin.seatId,
      checkin.flightId,
      checkin.passengerId
    );

    const boardingPass = await this.boardingPassService.generate({
      passengerId: checkin.passengerId,
      flightId: checkin.flightId,
      seatId: checkin.seatId,
    });

    await this.checkinRepository.updateOne(
      { checkInId: checkin.checkInId },
      {
        $set: {
          state: CheckInState.COMPLETED,
          'baggage.count': baggageValidation.bags.length,
          'baggage.weights': baggageValidation.bags.map((b: any) => b.weight),
          'baggage.fee': baggageValidation.totalFee,
          boardingPass,
          completedAt: new Date(),
        },
      }
    );

    await this.eventPublisher.publish('checkin.completed', {
      checkInId: checkin.checkInId,
      passengerId: checkin.passengerId,
      flightId: checkin.flightId,
      seatId: checkin.seatId,
    });

    logger.info('Check-in completed', { checkInId: checkin.checkInId });

    return {
      checkInId: checkin.checkInId,
      state: CheckInState.COMPLETED,
      boardingPass,
    };
  }

  async cancelCheckIn(checkInId: string, passengerId: string) {
    const checkin = await this.checkinRepository.findById(checkInId);

    if (!checkin) {
      throw new AppError(404, 'CHECKIN_NOT_FOUND', 'Check-in not found');
    }

    if (checkin.passengerId !== passengerId) {
      throw new AppError(403, 'FORBIDDEN', 'Passenger mismatch');
    }

    if (checkin.state !== CheckInState.COMPLETED) {
      throw new AppError(400, 'INVALID_STATE', 'Check-in is not completed');
    }

    if (checkin.seatId) {
      await this.seatClient.releaseSeat(checkin.seatId, checkin.flightId);
    }

    await this.checkinRepository.updateOne(
      { checkInId },
      {
        $set: {
          state: CheckInState.CANCELLED,
          updatedAt: new Date(),
        },
      }
    );

    await this.eventPublisher.publish('checkin.cancelled', {
      checkInId,
      passengerId,
      flightId: checkin.flightId,
      seatId: checkin.seatId,
    });

    logger.info('Check-in cancelled', { checkInId });

    return {
      checkInId,
      state: CheckInState.CANCELLED,
      seatId: checkin.seatId,
    };
  }

  async handlePaymentConfirmed(paymentEvent: any) {
    const checkin = await this.checkinRepository.findOne({
      checkInId: paymentEvent.checkInId,
      state: CheckInState.AWAITING_PAYMENT,
    });

    if (!checkin) {
      logger.warn('Check-in not found or not awaiting payment', { paymentEvent });
      return;
    }

    logger.info('Payment confirmed, finalizing check-in', {
      checkInId: checkin.checkInId,
    });

    const baggageValidation = {
      valid: true,
      totalFee: checkin.baggage?.fee || 0,
      bags: checkin.baggage?.weights.map((w, i) => ({
        bagIndex: i,
        weight: w,
        status: 'OVERWEIGHT' as const,
        fee: 0,
      })) || [],
    };

    await this.finalizeCheckIn(checkin, baggageValidation);
  }

  async getCheckIn(checkInId: string) {
    const checkin = await this.checkinRepository.findById(checkInId);

    if (!checkin) {
      throw new AppError(404, 'CHECKIN_NOT_FOUND', 'Check-in not found');
    }

    return {
      checkInId: checkin.checkInId,
      passengerId: checkin.passengerId,
      flightId: checkin.flightId,
      seatId: checkin.seatId,
      state: checkin.state,
      boardingPass: checkin.boardingPass,
      baggage: checkin.baggage,
      createdAt: checkin.createdAt,
      completedAt: checkin.completedAt,
    };
  }
}
