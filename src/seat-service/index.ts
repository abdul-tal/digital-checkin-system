import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { connectDatabase } from '../shared/config/database';
import { createRedisClient, createPubSubClients } from '../shared/config/redis';
import { SeatRepository } from './repositories/seat.repository';
import { SeatHoldService } from './services/seat-hold.service';
import { SeatManagementService } from './services/seat-management.service';
import { SeatCacheService } from './services/seat-cache.service';
import { SeatController } from './controllers/seat.controller';
import { SeatPublisher } from './events/publishers/seat.publisher';
import { HoldExpirationJob } from './jobs/hold-expiration.job';
import { EventBus } from '../shared/events/event-bus';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('seat-service');
const PORT = process.env.SEAT_SERVICE_PORT || 3001;

async function bootstrap() {
  try {
    // Connect to database
    await connectDatabase();

    // Create Redis clients
    const cacheRedis = createRedisClient();
    const { publisher, subscriber } = createPubSubClients();
    const eventBus = new EventBus(publisher, subscriber);

    // Wait for EventBus to be ready
    logger.info('Waiting for EventBus to be ready...');
    await eventBus.ready();
    logger.info('EventBus is ready');

    // Initialize services
    const seatRepository = new SeatRepository();
    const cacheService = new SeatCacheService(cacheRedis);
    const eventPublisher = new SeatPublisher(eventBus);
    const seatHoldService = new SeatHoldService(
      seatRepository,
      cacheService,
      eventPublisher
    );
    const seatManagementService = new SeatManagementService(seatRepository, cacheService);

    // Initialize controller
    const controller = new SeatController(seatHoldService, seatManagementService);

    // Create Express app
    const app = createApp(controller);

    // Start background job
    const holdExpirationJob = new HoldExpirationJob(
      seatRepository,
      cacheService,
      eventPublisher
    );
    holdExpirationJob.start();

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Seat Service listening on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Seat map API: http://localhost:${PORT}/api/v1/flights/{flightId}/seatmap`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      holdExpirationJob.stop();
      server.close();
      await eventBus.close();
      await cacheRedis.quit();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      holdExpirationJob.stop();
      server.close();
      await eventBus.close();
      await cacheRedis.quit();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start Seat Service', { error });
    process.exit(1);
  }
}

bootstrap();
