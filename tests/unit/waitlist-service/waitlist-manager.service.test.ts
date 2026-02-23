import { WaitlistManagerService } from '../../../src/waitlist-service/services/waitlist-manager.service';
import { WaitlistRepository } from '../../../src/waitlist-service/repositories/waitlist.repository';
import { PriorityCalculatorService } from '../../../src/waitlist-service/services/priority-calculator.service';
import { CheckInServiceClient } from '../../../src/waitlist-service/clients/checkin-service.client';
import { NotificationServiceClient } from '../../../src/waitlist-service/clients/notification-service.client';
import { WaitlistPublisher } from '../../../src/waitlist-service/events/publishers/waitlist.publisher';
import { LoyaltyTier } from '../../../src/shared/types/common.types';
import { AppError } from '../../../src/shared/errors/app-error';

jest.mock('../../../src/waitlist-service/repositories/waitlist.repository');
jest.mock('../../../src/waitlist-service/services/priority-calculator.service');
jest.mock('../../../src/waitlist-service/clients/checkin-service.client');
jest.mock('../../../src/waitlist-service/clients/notification-service.client');
jest.mock('../../../src/waitlist-service/events/publishers/waitlist.publisher');

describe('WaitlistManagerService', () => {
  let service: WaitlistManagerService;
  let mockRepository: jest.Mocked<WaitlistRepository>;
  let mockPriorityCalculator: jest.Mocked<PriorityCalculatorService>;
  let mockCheckinClient: jest.Mocked<CheckInServiceClient>;
  let mockNotificationClient: jest.Mocked<NotificationServiceClient>;
  let mockPublisher: jest.Mocked<WaitlistPublisher>;

  beforeEach(() => {
    mockRepository = new WaitlistRepository() as jest.Mocked<WaitlistRepository>;
    mockPriorityCalculator = new PriorityCalculatorService() as jest.Mocked<PriorityCalculatorService>;
    mockCheckinClient = new CheckInServiceClient() as jest.Mocked<CheckInServiceClient>;
    mockNotificationClient = new NotificationServiceClient() as jest.Mocked<NotificationServiceClient>;
    mockPublisher = new WaitlistPublisher({} as any) as jest.Mocked<WaitlistPublisher>;

    service = new WaitlistManagerService(
      mockRepository,
      mockPriorityCalculator,
      mockCheckinClient,
      mockNotificationClient,
      mockPublisher
    );

    jest.clearAllMocks();
  });

  describe('joinWaitlist', () => {
    it('should successfully add passenger to waitlist', async () => {
      mockRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          waitlistId: 'wl_123',
          passengerId: 'P12345',
          seatId: '12A',
          flightId: 'SK123',
          priorityScore: 300,
        } as any);
      mockPriorityCalculator.calculate.mockReturnValue(300);
      mockPriorityCalculator.estimateWaitTime.mockReturnValue('5-10 minutes');
      mockRepository.create.mockResolvedValue({
        waitlistId: 'wl_123',
        passengerId: 'P12345',
        seatId: '12A',
        flightId: 'SK123',
        priorityScore: 300,
      } as any);
      mockRepository.countDocuments.mockResolvedValue(0);
      mockPublisher.publish.mockResolvedValue();

      const result = await service.joinWaitlist({
        passengerId: 'P12345',
        checkInId: 'ci_test123',
        userId: 'U_12345',
        flightId: 'SK123',
        seatId: '12A',
        loyaltyTier: LoyaltyTier.GOLD,
        bookingTimestamp: new Date('2026-02-10T10:00:00Z'),
        hasSpecialNeeds: false,
      });

      expect(result.waitlistId).toMatch(/^wl_/);
      expect(result.position).toBe(1);
      expect(result.estimatedWaitTime).toBe('5-10 minutes');
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockPublisher.publish).toHaveBeenCalledWith('waitlist.joined', expect.any(Object));
    });

    it('should throw error if passenger already on waitlist', async () => {
      mockRepository.findOne.mockResolvedValue({
        waitlistId: 'wl_existing',
        passengerId: 'P12345',
        seatId: '12A',
      } as any);

      await expect(
        service.joinWaitlist({
          passengerId: 'P12345',
          checkInId: 'ci_test456',
          userId: 'U_12345',
          flightId: 'SK123',
          seatId: '12A',
          loyaltyTier: LoyaltyTier.GOLD,
          bookingTimestamp: new Date(),
        })
      ).rejects.toThrow(AppError);
    });

    it('should calculate correct priority score', async () => {
      mockRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          waitlistId: 'wl_123',
          passengerId: 'P12345',
          seatId: '12A',
          flightId: 'SK123',
          priorityScore: 500,
        } as any);
      mockPriorityCalculator.calculate.mockReturnValue(500);
      mockPriorityCalculator.estimateWaitTime.mockReturnValue('5-10 minutes');
      mockRepository.create.mockResolvedValue({
        waitlistId: 'wl_123',
        priorityScore: 500,
      } as any);
      mockRepository.countDocuments.mockResolvedValue(0);
      mockPublisher.publish.mockResolvedValue();

      await service.joinWaitlist({
        passengerId: 'P12345',
        checkInId: 'ci_test789',
        userId: 'U_12345',
        flightId: 'SK123',
        seatId: '12A',
        loyaltyTier: LoyaltyTier.PLATINUM,
        bookingTimestamp: new Date('2026-02-01T10:00:00Z'),
        hasSpecialNeeds: true,
      });

      expect(mockPriorityCalculator.calculate).toHaveBeenCalledWith({
        loyaltyTier: LoyaltyTier.PLATINUM,
        bookingTimestamp: expect.any(Date),
        hasSpecialNeeds: true,
      });
    });

    it('should set expiry time to 3 hours', async () => {
      let createdData: any;
      mockRepository.findOne
        .mockResolvedValueOnce(null)
        .mockImplementationOnce(async () => {
          return { ...createdData, waitlistId: 'wl_123' } as any;
        });
      mockPriorityCalculator.calculate.mockReturnValue(300);
      mockPriorityCalculator.estimateWaitTime.mockReturnValue('5-10 minutes');
      mockRepository.countDocuments.mockResolvedValue(0);
      mockPublisher.publish.mockResolvedValue();

      mockRepository.create.mockImplementation(async (data) => {
        createdData = data;
        return { ...data, waitlistId: 'wl_123' } as any;
      });

      await service.joinWaitlist({
        passengerId: 'P12345',
        checkInId: 'ci_test999',
        userId: 'U_12345',
        flightId: 'SK123',
        seatId: '12A',
        loyaltyTier: LoyaltyTier.GOLD,
        bookingTimestamp: new Date(),
      });

      expect(createdData.expiresAt).toBeDefined();
      const expiryTime = createdData.expiresAt.getTime() - Date.now();
      expect(expiryTime).toBeGreaterThan(3 * 60 * 60 * 1000 - 1000);
      expect(expiryTime).toBeLessThan(3 * 60 * 60 * 1000 + 1000);
    });
  });

  describe('leaveWaitlist', () => {
    it('should successfully remove passenger from waitlist', async () => {
      mockRepository.findOne.mockResolvedValue({
        waitlistId: 'wl_123',
        passengerId: 'P12345',
      } as any);
      mockRepository.deleteOne.mockResolvedValue();
      mockPublisher.publish.mockResolvedValue();

      await service.leaveWaitlist('wl_123', 'P12345');

      expect(mockRepository.deleteOne).toHaveBeenCalledWith({ waitlistId: 'wl_123' });
      expect(mockPublisher.publish).toHaveBeenCalledWith('waitlist.left', {
        waitlistId: 'wl_123',
        passengerId: 'P12345',
      });
    });

    it('should throw error if waitlist entry not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.leaveWaitlist('wl_invalid', 'P12345')
      ).rejects.toThrow(AppError);
    });

    it('should throw error if passenger mismatch', async () => {
      mockRepository.findOne.mockResolvedValue({
        waitlistId: 'wl_123',
        passengerId: 'P99999',
      } as any);

      await expect(
        service.leaveWaitlist('wl_123', 'P12345')
      ).rejects.toThrow(AppError);
    });
  });

  describe('processSeatAvailable', () => {
    beforeEach(() => {
      const mockSession = {
        withTransaction: jest.fn(async (callback) => await callback()),
        endSession: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(require('mongoose'), 'startSession').mockResolvedValue(mockSession);
    });

    it('should do nothing if no waitlist entries exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await service.processSeatAvailable('12A', 'SK123');

      expect(mockCheckinClient.completeCheckIn).not.toHaveBeenCalled();
    });

    it('should auto-complete check-in for highest priority passenger', async () => {
      const mockWaitlist = {
        waitlistId: 'wl_123',
        passengerId: 'P12345',
        checkInId: 'ci_test_auto',
        seatId: '12A',
        flightId: 'SK123',
        priorityScore: 500,
        baggage: { count: 1, weights: [20] },
      };

      mockRepository.findOne.mockResolvedValue(mockWaitlist as any);
      mockCheckinClient.completeCheckIn.mockResolvedValue({
        checkInId: 'ci_test_auto',
        state: 'COMPLETED',
        boardingPass: {
          passengerId: 'P12345',
          flightId: 'SK123',
          seatNumber: '12A',
          boardingGroup: 'A',
          qrCode: 'qr_code_data',
        },
      });
      mockRepository.deleteOne.mockResolvedValue();
      mockNotificationClient.send.mockResolvedValue();
      mockPublisher.publish.mockResolvedValue();

      await service.processSeatAvailable('12A', 'SK123');

      expect(mockCheckinClient.completeCheckIn).toHaveBeenCalledWith({
        checkInId: 'ci_test_auto',
        passengerId: 'P12345',
        userId: 'U_P12345',
        seatId: '12A',
        baggage: { count: 1, weights: [20] },
      });
      expect(mockRepository.deleteOne).toHaveBeenCalledWith(
        { waitlistId: 'wl_123' },
        expect.any(Object)
      );
      expect(mockNotificationClient.send).toHaveBeenCalled();
      expect(mockPublisher.publish).toHaveBeenCalledWith('waitlist.checkin.completed', expect.any(Object));
    });
  });
});
