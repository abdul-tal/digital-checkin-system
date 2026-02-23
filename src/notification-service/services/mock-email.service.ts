import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('mock-email-service');

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class MockEmailService {
  async send(email: Email): Promise<void> {
    await this.sleep(500);

    logger.info('📧 EMAIL sent', {
      to: email.to,
      subject: email.subject,
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📧 EMAIL`);
    console.log(`To: ${email.to}`);
    console.log(`Subject: ${email.subject}`);
    console.log(`\n${email.text}`);
    console.log(`${'='.repeat(60)}\n`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
