import { MockSmsService } from '../../../src/notification-service/services/mock-sms.service';

describe('MockSmsService', () => {
  let service: MockSmsService;

  beforeEach(() => {
    service = new MockSmsService();
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should send SMS successfully', async () => {
      const sms = {
        to: '+1-555-1234',
        message: 'Your seat is available',
      };

      await expect(service.send(sms)).resolves.not.toThrow();
    });

    it('should handle long messages', async () => {
      const sms = {
        to: '+1-555-1234',
        message: 'This is a very long SMS message that exceeds the typical 160 character limit but should still be handled correctly by the service',
      };

      await expect(service.send(sms)).resolves.not.toThrow();
    });

    it('should complete within reasonable time', async () => {
      const sms = {
        to: '+1-555-1234',
        message: 'Test message',
      };

      const start = Date.now();
      await service.send(sms);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(300);
      expect(duration).toBeLessThan(700);
    });

    it('should handle multiple phone numbers', async () => {
      const phoneNumbers = ['+1-555-1111', '+1-555-2222', '+1-555-3333'];

      for (const to of phoneNumbers) {
        await expect(
          service.send({
            to,
            message: 'Test SMS',
          })
        ).resolves.not.toThrow();
      }
    });

    it('should handle special characters in message', async () => {
      const sms = {
        to: '+1-555-1234',
        message: 'Flight SK123 @ Gate B12 🛫',
      };

      await expect(service.send(sms)).resolves.not.toThrow();
    });
  });
});
