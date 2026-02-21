import { CheckInOrchestratorService } from '../../../src/checkin-service/services/checkin-orchestrator.service';
import { CheckInRepository } from '../../../src/checkin-service/repositories/checkin.repository';
import { BaggageValidatorService } from '../../../src/checkin-service/services/baggage-validator.service';
import { BoardingPassService } from '../../../src/checkin-service/services/boarding-pass.service';
import { SeatServiceClient } from '../../../src/checkin-service/clients/seat-service.client';
import { PaymentServiceClient } from '../../../src/checkin-service/clients/payment-service.client';
import { CheckInPublisher } from '../../../src/checkin-service/events/publishers/checkin.publisher';
import { CheckInState } from '../../../src/shared/types/common.types';

jest.mock('../../../src/checkin-service/repositories/checkin.repository');
jest.mock('../../../src/checkin-service/services/baggage-validator.service');
jest.mock('../../../src/checkin-service/services/boarding-pass.service');
jest.mock('../../../src/checkin-service/clients/seat-service.client');
jest.mock('../../../src/checkin-service/clients/payment-service.client');
jest.mock('../../../src/checkin-service/events/publishers/checkin.publisher');

describe('CheckInOrchestratorService', () => {
  let orchestrator: CheckInOrchestratorService;
  let mockRepository: jest.Mocked<CheckInRepository>;
  let mockBaggageValidator: jest.Mocked<BaggageValidatorService>;
  let mockBoardingPassService: jest.Mocked<BoardingPassService>;
  let mockSeatClient: jest.Mocked<SeatServiceClient>;
  let mockPaymentClient: jest.Mocked<PaymentServiceClient>;
  let mockEventPublisher: jest.Mocked<CheckInPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = new CheckInRepository() as jest.Mocked<CheckInRepository>;
    mockBaggageValidator = new BaggageValidatorService(null as any) as jest.Mocked<BaggageValidatorService>;
    mockBoardingPassService = new BoardingPassService() as jest.Mocked<BoardingPassService>;
    mockSeatClient = new SeatServiceClient() as jest.Mocked<SeatServiceClient>;
    mockPaymentClient = new PaymentServiceClient() as jest.Mocked<PaymentServiceClient>;
    mockEventPublisher = new CheckInPublisher(null as any) as jest.Mocked<CheckInPublisher>;

    orchestrator = new CheckInOrchestratorService(
      mockRepository,
      mockBaggageValidator,
      mockBoardingPassService,
      mockSeatClient,
      mockPaymentClient,
      mockEventPublisher
    );
  });

  describe('startCheckIn', () => {
    it('should create check-in record successfully', async () => {
      const mockCheckIn = {
        checkInId: 'ci_123',
        passengerId: 'P12345',
        flightId: 'SK123',
        state: CheckInState.IN_PROGRESS,
      };

      mockRepository.create.mockResolvedValue(mockCheckIn as any);

      const result = await orchestrator.startCheckIn({
        passengerId: 'P12345',
        userId: 'U12345',
        bookingId: 'BK789',
      });

      expect(result).toEqual({
        checkInId: 'ci_123',
        state: CheckInState.IN_PROGRESS,
        flightId: 'SK123',
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          checkInId: expect.stringContaining('ci_'),
          passengerId: 'P12345',
          userId: 'U12345',
          flightId: 'SK123',
          state: CheckInState.IN_PROGRESS,
        })
      );
    });
  });

  describe('completeCheckIn - No Baggage', () => {
    it('should complete check-in without payment for zero baggage', async () => {
      const mockCheckIn = {
        checkInId: 'ci_123',
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '10A',
      };

      const mockBoardingPass = {
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '10A',
        gate: 'B12',
        boardingTime: new Date(),
        qrCode: 'data:image/png;base64,mock',
      };

      mockRepository.findById.mockResolvedValue(mockCheckIn as any);
      mockSeatClient.holdSeat.mockResolvedValue({
        holdId: 'hold_123',
        seatId: '10A',
        expiresAt: new Date(),
        remainingSeconds: 120,
      });
      mockRepository.updateOne.mockResolvedValue(undefined);
      mockBaggageValidator.validate.mockResolvedValue({
        valid: true,
        totalFee: 0,
        bags: [],
      });
      mockSeatClient.confirmSeat.mockResolvedValue(undefined);
      mockBoardingPassService.generate.mockResolvedValue(mockBoardingPass);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      const result = await orchestrator.completeCheckIn({
        checkInId: 'ci_123',
        passengerId: 'P12345',
        userId: 'U12345',
        seatId: '10A',
        baggage: { count: 0 },
      });

      expect(result.state).toBe(CheckInState.COMPLETED);
      expect(result).toHaveProperty('boardingPass');
      expect(mockSeatClient.holdSeat).toHaveBeenCalled();
      expect(mockSeatClient.confirmSeat).toHaveBeenCalled();
      expect(mockBoardingPassService.generate).toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'checkin.completed',
        expect.any(Object)
      );
    });
  });

  describe('completeCheckIn - With Payment', () => {
    it('should enter AWAITING_PAYMENT state for overweight baggage', async () => {
      const mockCheckIn = {
        checkInId: 'ci_123',
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '10A',
      };

      mockRepository.findById.mockResolvedValue(mockCheckIn as any);
      mockSeatClient.holdSeat.mockResolvedValue({
        holdId: 'hold_123',
        seatId: '10A',
        expiresAt: new Date(),
        remainingSeconds: 120,
      });
      mockRepository.updateOne.mockResolvedValue(undefined);
      mockBaggageValidator.validate.mockResolvedValue({
        valid: true,
        totalFee: 100,
        bags: [
          { bagIndex: 0, weight: 28, status: 'OVERWEIGHT', fee: 100 },
        ],
      });
      mockPaymentClient.initiatePayment.mockResolvedValue({
        paymentId: 'pay_123',
        paymentUrl: 'http://localhost:3003/pay/pay_123',
        expiresAt: new Date(),
      });

      const result: any = await orchestrator.completeCheckIn({
        checkInId: 'ci_123',
        passengerId: 'P12345',
        userId: 'U12345',
        seatId: '10A',
        baggage: { count: 1 },
      });

      expect(result.state).toBe(CheckInState.AWAITING_PAYMENT);
      expect(result.baggageFee).toBe(100);
      expect(result.paymentUrl).toBe('http://localhost:3003/pay/pay_123');
      
      expect(mockPaymentClient.initiatePayment).toHaveBeenCalledWith({
        amount: 100,
        passengerId: 'P12345',
        checkInId: 'ci_123',
      });

      // Should NOT confirm seat or generate boarding pass yet
      expect(mockSeatClient.confirmSeat).not.toHaveBeenCalled();
      expect(mockBoardingPassService.generate).not.toHaveBeenCalled();
    });
  });

  describe('completeCheckIn - Errors', () => {
    it('should throw error if check-in not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        orchestrator.completeCheckIn({
          checkInId: 'ci_nonexistent',
          passengerId: 'P12345',
          userId: 'U12345',
          seatId: '10A',
          baggage: { count: 0 },
        })
      ).rejects.toThrow('Check-in not found');
    });

    it('should throw error if passenger mismatch', async () => {
      mockRepository.findById.mockResolvedValue({
        checkInId: 'ci_123',
        passengerId: 'P99999',
      } as any);

      await expect(
        orchestrator.completeCheckIn({
          checkInId: 'ci_123',
          passengerId: 'P12345',
          userId: 'U12345',
          seatId: '10A',
          baggage: { count: 0 },
        })
      ).rejects.toThrow('Passenger mismatch');
    });

    it('should throw error and not hold seat if seat unavailable', async () => {
      mockRepository.findById.mockResolvedValue({
        checkInId: 'ci_123',
        passengerId: 'P12345',
        flightId: 'SK123',
      } as any);

      mockSeatClient.holdSeat.mockRejectedValue(new Error('Seat unavailable'));

      await expect(
        orchestrator.completeCheckIn({
          checkInId: 'ci_123',
          passengerId: 'P12345',
          userId: 'U12345',
          seatId: '10A',
          baggage: { count: 0 },
        })
      ).rejects.toThrow('Failed to hold seat');

      expect(mockBaggageValidator.validate).not.toHaveBeenCalled();
    });

    it('should release seat if baggage too heavy', async () => {
      mockRepository.findById.mockResolvedValue({
        checkInId: 'ci_123',
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '10A',
      } as any);

      mockSeatClient.holdSeat.mockResolvedValue({} as any);
      mockRepository.updateOne.mockResolvedValue(undefined);
      mockBaggageValidator.validate.mockResolvedValue({
        valid: false,
        totalFee: 0,
        bags: [
          { bagIndex: 0, weight: 35, status: 'REJECTED', fee: 0, reason: 'Too heavy' },
        ],
      });
      mockSeatClient.releaseSeat.mockResolvedValue(undefined);

      await expect(
        orchestrator.completeCheckIn({
          checkInId: 'ci_123',
          passengerId: 'P12345',
          userId: 'U12345',
          seatId: '10A',
          baggage: { count: 1 },
        })
      ).rejects.toThrow('One or more bags exceed the maximum weight limit');

      expect(mockSeatClient.releaseSeat).toHaveBeenCalledWith('10A', 'SK123');
    });
  });

  describe('cancelCheckIn', () => {
    it('should cancel completed check-in and release seat', async () => {
      mockRepository.findById.mockResolvedValue({
        checkInId: 'ci_123',
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '10A',
        state: CheckInState.COMPLETED,
      } as any);

      mockSeatClient.releaseSeat.mockResolvedValue(undefined);
      mockRepository.updateOne.mockResolvedValue(undefined);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      const result = await orchestrator.cancelCheckIn('ci_123', 'P12345');

      expect(result.state).toBe(CheckInState.CANCELLED);
      expect(mockSeatClient.releaseSeat).toHaveBeenCalledWith('10A', 'SK123');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'checkin.cancelled',
        expect.any(Object)
      );
    });

    it('should throw error if check-in not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        orchestrator.cancelCheckIn('ci_nonexistent', 'P12345')
      ).rejects.toThrow('Check-in not found');
    });

    it('should throw error if passenger mismatch', async () => {
      mockRepository.findById.mockResolvedValue({
        checkInId: 'ci_123',
        passengerId: 'P99999',
        state: CheckInState.COMPLETED,
      } as any);

      await expect(
        orchestrator.cancelCheckIn('ci_123', 'P12345')
      ).rejects.toThrow('Passenger mismatch');
    });

    it('should throw error if check-in not completed', async () => {
      mockRepository.findById.mockResolvedValue({
        checkInId: 'ci_123',
        passengerId: 'P12345',
        state: CheckInState.IN_PROGRESS,
      } as any);

      await expect(
        orchestrator.cancelCheckIn('ci_123', 'P12345')
      ).rejects.toThrow('Check-in is not completed');
    });
  });

  describe('handlePaymentConfirmed', () => {
    it('should complete check-in after payment confirmation', async () => {
      const mockCheckIn = {
        checkInId: 'ci_123',
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '10A',
        state: CheckInState.AWAITING_PAYMENT,
        baggage: {
          fee: 100,
          weights: [28],
        },
      };

      mockRepository.findOne.mockResolvedValue(mockCheckIn as any);
      mockSeatClient.confirmSeat.mockResolvedValue(undefined);
      mockBoardingPassService.generate.mockResolvedValue({
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '10A',
        gate: 'B12',
        boardingTime: new Date(),
        qrCode: 'mock',
      });
      mockRepository.updateOne.mockResolvedValue(undefined);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      await orchestrator.handlePaymentConfirmed({
        paymentId: 'pay_123',
        checkInId: 'ci_123',
        passengerId: 'P12345',
        amount: 100,
      });

      expect(mockSeatClient.confirmSeat).toHaveBeenCalledWith('10A', 'SK123', 'P12345');
      expect(mockBoardingPassService.generate).toHaveBeenCalled();
      expect(mockRepository.updateOne).toHaveBeenCalledWith(
        { checkInId: 'ci_123' },
        expect.objectContaining({
          $set: expect.objectContaining({
            state: CheckInState.COMPLETED,
          }),
        })
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('checkin.completed', expect.any(Object));
    });

    it('should do nothing if check-in not found or not awaiting payment', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await orchestrator.handlePaymentConfirmed({
        paymentId: 'pay_123',
        checkInId: 'ci_nonexistent',
        passengerId: 'P12345',
        amount: 100,
      });

      expect(mockSeatClient.confirmSeat).not.toHaveBeenCalled();
      expect(mockBoardingPassService.generate).not.toHaveBeenCalled();
    });
  });
});
