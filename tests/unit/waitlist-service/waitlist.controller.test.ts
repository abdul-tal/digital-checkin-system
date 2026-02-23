import { Request, Response, NextFunction } from 'express';
import { WaitlistController } from '../../../src/waitlist-service/controllers/waitlist.controller';
import { WaitlistManagerService } from '../../../src/waitlist-service/services/waitlist-manager.service';
import { LoyaltyTier } from '../../../src/shared/types/common.types';

jest.mock('../../../src/waitlist-service/services/waitlist-manager.service');

describe('WaitlistController', () => {
  let controller: WaitlistController;
  let mockManager: jest.Mocked<WaitlistManagerService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockManager = new WaitlistManagerService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    ) as jest.Mocked<WaitlistManagerService>;

    controller = new WaitlistController(mockManager);

    mockRequest = {
      body: {},
      params: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('joinWaitlist', () => {
    it('should join waitlist successfully', async () => {
      mockRequest.body = {
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '12A',
        loyaltyTier: 'GOLD',
        bookingTimestamp: '2026-02-10T10:00:00Z',
        hasSpecialNeeds: false,
      };

      const mockResult = {
        waitlistId: 'wl_123',
        position: 1,
        estimatedWaitTime: '5-10 minutes',
      };

      mockManager.joinWaitlist.mockResolvedValue(mockResult);

      await controller.joinWaitlist(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockManager.joinWaitlist).toHaveBeenCalledWith({
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '12A',
        loyaltyTier: LoyaltyTier.GOLD,
        bookingTimestamp: expect.any(Date),
        hasSpecialNeeds: false,
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next with error on failure', async () => {
      mockRequest.body = {
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '12A',
        loyaltyTier: 'GOLD',
        bookingTimestamp: '2026-02-10T10:00:00Z',
      };

      const error = new Error('Test error');
      mockManager.joinWaitlist.mockRejectedValue(error);

      await controller.joinWaitlist(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should handle special needs flag', async () => {
      mockRequest.body = {
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '12A',
        loyaltyTier: 'PLATINUM',
        bookingTimestamp: '2026-02-01T10:00:00Z',
        hasSpecialNeeds: true,
      };

      mockManager.joinWaitlist.mockResolvedValue({
        waitlistId: 'wl_123',
        position: 1,
        estimatedWaitTime: '5-10 minutes',
      });

      await controller.joinWaitlist(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockManager.joinWaitlist).toHaveBeenCalledWith(
        expect.objectContaining({ hasSpecialNeeds: true })
      );
    });
  });

  describe('leaveWaitlist', () => {
    it('should leave waitlist successfully', async () => {
      mockRequest.params = { waitlistId: 'wl_123' };
      mockRequest.body = { passengerId: 'P12345' };

      mockManager.leaveWaitlist.mockResolvedValue();

      await controller.leaveWaitlist(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockManager.leaveWaitlist).toHaveBeenCalledWith('wl_123', 'P12345');
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Removed from waitlist successfully',
        waitlistId: 'wl_123',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next with error on failure', async () => {
      mockRequest.params = { waitlistId: 'wl_invalid' };
      mockRequest.body = { passengerId: 'P12345' };

      const error = new Error('Not found');
      mockManager.leaveWaitlist.mockRejectedValue(error);

      await controller.leaveWaitlist(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });
});
