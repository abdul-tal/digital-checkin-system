import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createPubSubClients } from '../shared/config/redis';
import { EventBus } from '../shared/events/event-bus';
import { NotificationDispatcherService } from './services/notification-dispatcher.service';
import { MockPushService } from './services/mock-push.service';
import { MockEmailService } from './services/mock-email.service';
import { MockSmsService } from './services/mock-sms.service';
import { NotificationController } from './controllers/notification.controller';
import { WaitlistSubscriber } from './events/subscribers/waitlist.subscriber';
import { CheckInSubscriber } from './events/subscribers/checkin.subscriber';
import { errorHandler } from '../shared/middleware/error-handler';
import { requestLogger } from '../shared/middleware/request-logger';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('notification-service');
const PORT = process.env.NOTIFICATION_SERVICE_PORT || 3005;

async function bootstrap() {
  try {
    const { publisher, subscriber } = createPubSubClients();
    const eventBus = new EventBus(publisher, subscriber);

    // Wait for EventBus to be ready
    logger.info('Waiting for EventBus to be ready...');
    await eventBus.ready();
    logger.info('EventBus is ready');

    const pushService = new MockPushService();
    const emailService = new MockEmailService();
    const smsService = new MockSmsService();

    const dispatcher = new NotificationDispatcherService(
      pushService,
      emailService,
      smsService
    );

    const controller = new NotificationController(dispatcher);

    const app = express();
    app.use(express.json());
    app.use(requestLogger);

    app.post('/api/v1/notifications/send', controller.send);
    app.get('/health', (_req, res) => {
      res.json({ status: 'OK', service: 'notification-service' });
    });

    app.use(errorHandler);

    const waitlistSubscriber = new WaitlistSubscriber(eventBus, dispatcher);
    waitlistSubscriber.start();

    const checkinSubscriber = new CheckInSubscriber(eventBus, dispatcher);
    checkinSubscriber.start();

    app.listen(PORT, () => {
      logger.info(`Notification Service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Notification Service', { error });
    process.exit(1);
  }
}

bootstrap();
