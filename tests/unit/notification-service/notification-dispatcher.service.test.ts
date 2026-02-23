import { NotificationDispatcherService } from '../../../src/notification-service/services/notification-dispatcher.service';
import { MockPushService } from '../../../src/notification-service/services/mock-push.service';
import { MockEmailService } from '../../../src/notification-service/services/mock-email.service';
import { MockSmsService } from '../../../src/notification-service/services/mock-sms.service';

jest.mock('../../../src/notification-service/services/mock-push.service');
jest.mock('../../../src/notification-service/services/mock-email.service');
jest.mock('../../../src/notification-service/services/mock-sms.service');

describe('NotificationDispatcherService', () => {
  let service: NotificationDispatcherService;
  let mockPushService: jest.Mocked<MockPushService>;
  let mockEmailService: jest.Mocked<MockEmailService>;
  let mockSmsService: jest.Mocked<MockSmsService>;

  beforeEach(() => {
    mockPushService = new MockPushService() as jest.Mocked<MockPushService>;
    mockEmailService = new MockEmailService() as jest.Mocked<MockEmailService>;
    mockSmsService = new MockSmsService() as jest.Mocked<MockSmsService>;

    service = new NotificationDispatcherService(
      mockPushService,
      mockEmailService,
      mockSmsService
    );

    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should send waitlist available notification to push channel', async () => {
      mockPushService.send.mockResolvedValue();

      await service.send({
        passengerId: 'P12345',
        type: 'WAITLIST_SEAT_AVAILABLE',
        channels: ['push'],
        data: {
          seatId: '12A',
          flightId: 'SK123',
          expiresAt: new Date(),
        },
      });

      expect(mockPushService.send).toHaveBeenCalledWith({
        userId: 'P12345',
        title: '🎉 Your Seat is Available!',
        body: expect.stringContaining('Seat 12A on flight SK123'),
        data: expect.any(Object),
      });
      expect(mockEmailService.send).not.toHaveBeenCalled();
      expect(mockSmsService.send).not.toHaveBeenCalled();
    });

    it('should send to multiple channels', async () => {
      mockPushService.send.mockResolvedValue();
      mockEmailService.send.mockResolvedValue();
      mockSmsService.send.mockResolvedValue();

      await service.send({
        passengerId: 'P12345',
        type: 'WAITLIST_SEAT_AVAILABLE',
        channels: ['push', 'email', 'sms'],
        data: {
          seatId: '12A',
          flightId: 'SK123',
          expiresAt: new Date(),
        },
      });

      expect(mockPushService.send).toHaveBeenCalled();
      expect(mockEmailService.send).toHaveBeenCalled();
      expect(mockSmsService.send).toHaveBeenCalled();
    });

    it('should send check-in complete notification', async () => {
      mockPushService.send.mockResolvedValue();
      mockEmailService.send.mockResolvedValue();

      await service.send({
        passengerId: 'P12345',
        type: 'CHECKIN_COMPLETED',
        channels: ['push', 'email'],
        data: {
          seatId: '12A',
          flightId: 'SK123',
          gate: 'B12',
        },
      });

      expect(mockPushService.send).toHaveBeenCalledWith({
        userId: 'P12345',
        title: '✅ Check-In Complete',
        body: expect.stringContaining('flight SK123'),
        data: expect.any(Object),
      });
      expect(mockEmailService.send).toHaveBeenCalledWith({
        to: 'P12345@example.com',
        subject: expect.stringContaining('Check-In Confirmation'),
        html: expect.any(String),
        text: expect.any(String),
      });
    });

    it('should handle unknown notification type gracefully', async () => {
      await expect(
        service.send({
          passengerId: 'P12345',
          type: 'UNKNOWN_TYPE',
          channels: ['push'],
          data: {},
        })
      ).resolves.not.toThrow();

      expect(mockPushService.send).not.toHaveBeenCalled();
    });

    it('should continue if one channel fails', async () => {
      mockPushService.send.mockRejectedValue(new Error('Push failed'));
      mockEmailService.send.mockResolvedValue();

      await expect(
        service.send({
          passengerId: 'P12345',
          type: 'WAITLIST_SEAT_AVAILABLE',
          channels: ['push', 'email'],
          data: {
            seatId: '12A',
            flightId: 'SK123',
            expiresAt: new Date(),
          },
        })
      ).resolves.not.toThrow();

      expect(mockEmailService.send).toHaveBeenCalled();
    });

    it('should handle all channels failing gracefully', async () => {
      mockPushService.send.mockRejectedValue(new Error('Push failed'));
      mockEmailService.send.mockRejectedValue(new Error('Email failed'));
      mockSmsService.send.mockRejectedValue(new Error('SMS failed'));

      await expect(
        service.send({
          passengerId: 'P12345',
          type: 'WAITLIST_SEAT_AVAILABLE',
          channels: ['push', 'email', 'sms'],
          data: {
            seatId: '12A',
            flightId: 'SK123',
            expiresAt: new Date(),
          },
        })
      ).resolves.not.toThrow();
    });

    it('should format email address from passenger ID', async () => {
      mockEmailService.send.mockResolvedValue();

      await service.send({
        passengerId: 'P12345',
        type: 'WAITLIST_SEAT_AVAILABLE',
        channels: ['email'],
        data: {
          seatId: '12A',
          flightId: 'SK123',
          expiresAt: new Date(),
        },
      });

      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'P12345@example.com',
        })
      );
    });

    it('should format phone number from passenger ID', async () => {
      mockSmsService.send.mockResolvedValue();

      await service.send({
        passengerId: 'P12345',
        type: 'WAITLIST_SEAT_AVAILABLE',
        channels: ['sms'],
        data: {
          seatId: '12A',
          flightId: 'SK123',
          expiresAt: new Date(),
        },
      });

      expect(mockSmsService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+1-555-P12345',
        })
      );
    });
  });
});
