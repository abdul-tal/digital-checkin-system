import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { connectDatabase } from '../shared/config/database';
import { createPubSubClients } from '../shared/config/redis';
import { EventBus } from '../shared/events/event-bus';
import { PaymentRepository } from './repositories/payment.repository';
import { MockPaymentService } from './services/mock-payment.service';
import { PaymentController } from './controllers/payment.controller';
import { PaymentPublisher } from './events/publishers/payment.publisher';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('payment-service');
const PORT = process.env.PAYMENT_SERVICE_PORT || 3003;

async function bootstrap() {
  try {
    await connectDatabase();

    const { publisher, subscriber } = createPubSubClients();
    const eventBus = new EventBus(publisher, subscriber);

    const paymentRepository = new PaymentRepository();
    const eventPublisher = new PaymentPublisher(eventBus);
    const paymentService = new MockPaymentService(paymentRepository, eventPublisher);

    const controller = new PaymentController(paymentService);

    const app = createApp(controller);

    app.listen(PORT, () => {
      logger.info(`Payment Service listening on port ${PORT}`);
      logger.info(`Mock payment page: http://localhost:${PORT}/pay/{paymentId}`);
    });
  } catch (error) {
    logger.error('Failed to start Payment Service', { error });
    process.exit(1);
  }
}

bootstrap();
