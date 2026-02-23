import { MockEmailService } from '../../../src/notification-service/services/mock-email.service';

describe('MockEmailService', () => {
  let service: MockEmailService;

  beforeEach(() => {
    service = new MockEmailService();
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should send email successfully', async () => {
      const email = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<h1>Test</h1>',
        text: 'Test email text',
      };

      await expect(service.send(email)).resolves.not.toThrow();
    });

    it('should send email with HTML content', async () => {
      const email = {
        to: 'passenger@example.com',
        subject: 'Boarding Pass',
        html: '<h2>Your Boarding Pass</h2><p>Flight SK123</p>',
        text: 'Your Boarding Pass - Flight SK123',
      };

      await expect(service.send(email)).resolves.not.toThrow();
    });

    it('should complete within reasonable time', async () => {
      const email = {
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      };

      const start = Date.now();
      await service.send(email);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(500);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle multiple recipients', async () => {
      const recipients = ['user1@example.com', 'user2@example.com', 'user3@example.com'];

      for (const to of recipients) {
        await expect(
          service.send({
            to,
            subject: 'Test',
            html: '<p>Test</p>',
            text: 'Test',
          })
        ).resolves.not.toThrow();
      }
    });
  });
});
