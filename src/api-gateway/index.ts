import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { AuthService } from './services/auth.service';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('api-gateway');
const PORT = process.env.API_GATEWAY_PORT || 3000;

async function bootstrap() {
  try {
    const authService = new AuthService();

    const app = createApp(authService);

    app.listen(PORT, () => {
      logger.info(`API Gateway listening on port ${PORT}`);
      logger.info('Service endpoints:');
      logger.info(`  - Seat Service: ${process.env.SEAT_SERVICE_URL}`);
      logger.info(`  - Check-In Service: ${process.env.CHECKIN_SERVICE_URL}`);
      logger.info(`  - Payment Service: ${process.env.PAYMENT_SERVICE_URL}`);
      logger.info(`  - Waitlist Service: ${process.env.WAITLIST_SERVICE_URL}`);
    });
  } catch (error) {
    logger.error('Failed to start API Gateway', { error });
    process.exit(1);
  }
}

bootstrap();
