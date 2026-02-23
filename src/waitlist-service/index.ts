import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { connectDatabase } from '../shared/config/database';
import { createPubSubClients } from '../shared/config/redis';
import { EventBus } from '../shared/events/event-bus';
import { WaitlistRepository } from './repositories/waitlist.repository';
import { WaitlistManagerService } from './services/waitlist-manager.service';
import { PriorityCalculatorService } from './services/priority-calculator.service';
import { CheckInServiceClient } from './clients/checkin-service.client';
import { NotificationServiceClient } from './clients/notification-service.client';
import { WaitlistController } from './controllers/waitlist.controller';
import { WaitlistPublisher } from './events/publishers/waitlist.publisher';
import { SeatSubscriber } from './events/subscribers/seat.subscriber';
import { WaitlistCleanupJob } from './jobs/waitlist-cleanup.job';
import { createWaitlistRoutes } from './routes/waitlist.routes';
import { errorHandler } from '../shared/middleware/error-handler';
import { requestLogger } from '../shared/middleware/request-logger';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('waitlist-service');
const PORT = process.env.WAITLIST_SERVICE_PORT || 3004;

async function bootstrap() {
  try {
    await connectDatabase();

    const { publisher, subscriber } = createPubSubClients();
    const eventBus = new EventBus(publisher, subscriber);

    // Wait for EventBus to be ready before proceeding
    logger.info('Waiting for EventBus to be ready...');
    await eventBus.ready();
    logger.info('EventBus is ready');

    const waitlistRepository = new WaitlistRepository();
    const priorityCalculator = new PriorityCalculatorService();
    const checkinClient = new CheckInServiceClient();
    const notificationClient = new NotificationServiceClient();
    const eventPublisher = new WaitlistPublisher(eventBus);

    const waitlistManager = new WaitlistManagerService(
      waitlistRepository,
      priorityCalculator,
      checkinClient,
      notificationClient,
      eventPublisher
    );

    const controller = new WaitlistController(waitlistManager);

    const app = express();
    app.use(express.json());
    app.use(requestLogger);
    app.use('/api/v1', createWaitlistRoutes(controller));
    app.get('/health', (_req, res) => {
      res.json({ status: 'OK', service: 'waitlist-service' });
    });
    app.use(errorHandler);

    // Subscribe to events AFTER EventBus is ready
    const seatSubscriber = new SeatSubscriber(eventBus, waitlistManager);
    seatSubscriber.start();

    // Test Redis pub/sub connection
    logger.info('Testing Redis pub/sub connection...');
    const pubsubWorking = await eventBus.testConnection();
    if (!pubsubWorking) {
      logger.error('Redis pub/sub test failed! Events may not be delivered.');
    } else {
      logger.info('Redis pub/sub test passed! Event bus is working correctly.');
    }

    // Log event bus debug info
    logger.info('Event bus debug info', eventBus.getDebugInfo());

    const cleanupJob = new WaitlistCleanupJob(waitlistRepository);
    cleanupJob.start();

    app.listen(PORT, () => {
      logger.info(`Waitlist Service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Waitlist Service', { error });
    process.exit(1);
  }
}

bootstrap();
