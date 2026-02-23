import { MockPushService } from './mock-push.service';
import { MockEmailService } from './mock-email.service';
import { MockSmsService } from './mock-sms.service';
import { waitlistAvailableTemplate } from '../templates/waitlist-available.template';
import { waitlistCheckinCompletedTemplate } from '../templates/waitlist-checkin-completed.template';
import { checkinCompleteTemplate } from '../templates/checkin-complete.template';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('notification-dispatcher');

export interface SendNotificationRequest {
  passengerId: string;
  type: string;
  channels: ('push' | 'email' | 'sms')[];
  data: Record<string, any>;
}

export class NotificationDispatcherService {
  private templates: Map<string, any>;

  constructor(
    private pushService: MockPushService,
    private emailService: MockEmailService,
    private smsService: MockSmsService
  ) {
    this.templates = new Map<string, any>([
      [waitlistAvailableTemplate.type, waitlistAvailableTemplate],
      [waitlistCheckinCompletedTemplate.type, waitlistCheckinCompletedTemplate],
      [checkinCompleteTemplate.type, checkinCompleteTemplate],
    ]);
  }

  async send(req: SendNotificationRequest): Promise<void> {
    const template = this.templates.get(req.type);

    if (!template) {
      logger.warn('Template not found', { type: req.type });
      return;
    }

    const content = template.render(req.data);

    const promises = req.channels.map(async (channel) => {
      try {
        switch (channel) {
          case 'push':
            await this.pushService.send({
              userId: req.passengerId,
              title: content.push.title,
              body: content.push.body,
              data: req.data,
            });
            break;

          case 'email':
            await this.emailService.send({
              to: `${req.passengerId}@example.com`,
              subject: content.email.subject,
              html: content.email.html,
              text: content.email.text,
            });
            break;

          case 'sms':
            await this.smsService.send({
              to: `+1-555-${req.passengerId}`,
              message: content.sms,
            });
            break;
        }

        logger.info('Notification sent', {
          channel,
          type: req.type,
          passengerId: req.passengerId,
        });
      } catch (error: any) {
        logger.error('Notification failed', {
          channel,
          type: req.type,
          error: error.message,
        });
      }
    });

    await Promise.allSettled(promises);
  }
}
