import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { connectDatabase } from '../shared/config/database';
import { createPubSubClients } from '../shared/config/redis';
import { EventBus } from '../shared/events/event-bus';
import { CheckInRepository } from './repositories/checkin.repository';
import { CheckInOrchestratorService } from './services/checkin-orchestrator.service';
import { BaggageValidatorService } from './services/baggage-validator.service';
import { BoardingPassService } from './services/boarding-pass.service';
import { SeatServiceClient } from './clients/seat-service.client';
import { PaymentServiceClient } from './clients/payment-service.client';
import { WeightServiceClient } from './clients/weight-service.client';
import { CheckInController } from './controllers/checkin.controller';
import { CheckInPublisher } from './events/publishers/checkin.publisher';
import { PaymentSubscriber } from './events/subscribers/payment.subscriber';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('checkin-service');
const PORT = process.env.CHECKIN_SERVICE_PORT || 3002;

async function bootstrap() {
  try {
    await connectDatabase();

    const { publisher, subscriber } = createPubSubClients();
    const eventBus = new EventBus(publisher, subscriber);

    // Wait for EventBus to be ready
    logger.info('Waiting for EventBus to be ready...');
    await eventBus.ready();
    logger.info('EventBus is ready');

    const checkinRepository = new CheckInRepository();
    const weightClient = new WeightServiceClient();
    const baggageValidator = new BaggageValidatorService(weightClient);
    const boardingPassService = new BoardingPassService();
    const seatClient = new SeatServiceClient();
    const paymentClient = new PaymentServiceClient();
    const eventPublisher = new CheckInPublisher(eventBus);

    const orchestrator = new CheckInOrchestratorService(
      checkinRepository,
      baggageValidator,
      boardingPassService,
      seatClient,
      paymentClient,
      eventPublisher
    );

    const controller = new CheckInController(orchestrator);

    const app = createApp(controller);

    const paymentSubscriber = new PaymentSubscriber(eventBus, orchestrator);
    paymentSubscriber.start();

    app.listen(PORT, () => {
      logger.info(`Check-In Service listening on port ${PORT}`);
      logger.info('Health check: http://localhost:3002/health');
    });
  } catch (error) {
    logger.error('Failed to start Check-In Service', { error });
    process.exit(1);
  }
}

bootstrap();
