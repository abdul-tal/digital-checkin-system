import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('mock-push-service');

export interface PushNotification {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export class MockPushService {
  async send(notification: PushNotification): Promise<void> {
    await this.sleep(200);

    logger.info('📱 PUSH notification sent', {
      userId: notification.userId,
      title: notification.title,
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📱 PUSH NOTIFICATION`);
    console.log(`To: ${notification.userId}`);
    console.log(`Title: ${notification.title}`);
    console.log(`Body: ${notification.body}`);
    console.log(`${'='.repeat(60)}\n`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
