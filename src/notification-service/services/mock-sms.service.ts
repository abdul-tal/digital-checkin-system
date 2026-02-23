import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('mock-sms-service');

export interface SMS {
  to: string;
  message: string;
}

export class MockSmsService {
  async send(sms: SMS): Promise<void> {
    await this.sleep(300);

    logger.info('📱 SMS sent', {
      to: sms.to,
      messageLength: sms.message.length,
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📱 SMS`);
    console.log(`To: ${sms.to}`);
    console.log(`Message: ${sms.message}`);
    console.log(`${'='.repeat(60)}\n`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
