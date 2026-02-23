import { MockPushService } from '../../../src/notification-service/services/mock-push.service';

describe('MockPushService', () => {
  let service: MockPushService;

  beforeEach(() => {
    service = new MockPushService();
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should send push notification successfully', async () => {
      const notification = {
        userId: 'P12345',
        title: 'Test Notification',
        body: 'This is a test notification',
      };

      await expect(service.send(notification)).resolves.not.toThrow();
    });

    it('should send notification with data payload', async () => {
      const notification = {
        userId: 'P12345',
        title: 'Test Notification',
        body: 'This is a test',
        data: {
          seatId: '12A',
          flightId: 'SK123',
        },
      };

      await expect(service.send(notification)).resolves.not.toThrow();
    });

    it('should complete within reasonable time', async () => {
      const notification = {
        userId: 'P12345',
        title: 'Test',
        body: 'Test body',
      };

      const start = Date.now();
      await service.send(notification);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(200);
      expect(duration).toBeLessThan(500);
    });

    it('should handle multiple notifications sequentially', async () => {
      const notifications = [
        { userId: 'P1', title: 'Test 1', body: 'Body 1' },
        { userId: 'P2', title: 'Test 2', body: 'Body 2' },
        { userId: 'P3', title: 'Test 3', body: 'Body 3' },
      ];

      for (const notif of notifications) {
        await expect(service.send(notif)).resolves.not.toThrow();
      }
    });
  });
});
