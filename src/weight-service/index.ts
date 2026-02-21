import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { MockWeightService } from './services/mock-weight.service';
import { WeightController } from './controllers/weight.controller';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('weight-service');
const PORT = process.env.WEIGHT_SERVICE_PORT || 3006;

async function bootstrap() {
  try {
    const weightService = new MockWeightService();
    const controller = new WeightController(weightService);

    const app = createApp(controller);

    app.listen(PORT, () => {
      logger.info(`Weight Service listening on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Weigh API: http://localhost:${PORT}/api/v1/baggage/weigh`);
    });
  } catch (error) {
    logger.error('Failed to start Weight Service', { error });
    process.exit(1);
  }
}

bootstrap();
