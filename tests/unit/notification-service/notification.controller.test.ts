import { Request, Response, NextFunction } from 'express';
import { NotificationController } from '../../../src/notification-service/controllers/notification.controller';
import { NotificationDispatcherService } from '../../../src/notification-service/services/notification-dispatcher.service';

jest.mock('../../../src/notification-service/services/notification-dispatcher.service');

describe('NotificationController', () => {
  let controller: NotificationController;
  let mockDispatcher: jest.Mocked<NotificationDispatcherService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockDispatcher = new NotificationDispatcherService(
      {} as any,
      {} as any,
      {} as any
    ) as jest.Mocked<NotificationDispatcherService>;

    controller = new NotificationController(mockDispatcher);

    mockRequest = {
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should send notification successfully', async () => {
      mockRequest.body = {
        passengerId: 'P12345',
        type: 'WAITLIST_SEAT_AVAILABLE',
        channels: ['push', 'email'],
        data: {
          seatId: '12A',
          flightId: 'SK123',
          expiresAt: '2026-02-21T10:05:00Z',
        },
      };

      mockDispatcher.send.mockResolvedValue();

      await controller.send(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockDispatcher.send).toHaveBeenCalledWith({
        passengerId: 'P12345',
        type: 'WAITLIST_SEAT_AVAILABLE',
        channels: ['push', 'email'],
        data: expect.any(Object),
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Notification sent successfully',
        passengerId: 'P12345',
        channels: ['push', 'email'],
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle single channel', async () => {
      mockRequest.body = {
        passengerId: 'P12345',
        type: 'CHECKIN_COMPLETED',
        channels: ['push'],
        data: { seatId: '12A', flightId: 'SK123', gate: 'B12' },
      };

      mockDispatcher.send.mockResolvedValue();

      await controller.send(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockDispatcher.send).toHaveBeenCalledWith(
        expect.objectContaining({
          channels: ['push'],
        })
      );
    });

    it('should handle all three channels', async () => {
      mockRequest.body = {
        passengerId: 'P12345',
        type: 'WAITLIST_SEAT_AVAILABLE',
        channels: ['push', 'email', 'sms'],
        data: { seatId: '12A', flightId: 'SK123', expiresAt: new Date() },
      };

      mockDispatcher.send.mockResolvedValue();

      await controller.send(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockDispatcher.send).toHaveBeenCalledWith(
        expect.objectContaining({
          channels: ['push', 'email', 'sms'],
        })
      );
    });

    it('should call next with error on failure', async () => {
      mockRequest.body = {
        passengerId: 'P12345',
        type: 'WAITLIST_SEAT_AVAILABLE',
        channels: ['push'],
        data: {},
      };

      const error = new Error('Dispatcher error');
      mockDispatcher.send.mockRejectedValue(error);

      await controller.send(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should pass through all notification data', async () => {
      const notificationData = {
        seatId: '15C',
        flightId: 'SK456',
        gate: 'A10',
        boardingTime: '2026-02-21T12:00:00Z',
        customField: 'test',
      };

      mockRequest.body = {
        passengerId: 'P99999',
        type: 'CHECKIN_COMPLETED',
        channels: ['email'],
        data: notificationData,
      };

      mockDispatcher.send.mockResolvedValue();

      await controller.send(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockDispatcher.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: notificationData,
        })
      );
    });
  });
});
