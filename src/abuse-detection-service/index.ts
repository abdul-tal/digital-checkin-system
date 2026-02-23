import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { connectDatabase } from '../shared/config/database';
import { createRedisClient } from '../shared/config/redis';
import { PatternDetectorService } from './services/pattern-detector.service';
import { BlockingService } from './services/blocking.service';
import { AuditLoggerService } from './services/audit-logger.service';
import { AbuseController } from './controllers/abuse.controller';
import { createAbuseRoutes } from './routes/abuse.routes';
import { errorHandler } from '../shared/middleware/error-handler';
import { requestLogger } from '../shared/middleware/request-logger';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('abuse-detection-service');
const PORT = process.env.ABUSE_DETECTION_SERVICE_PORT || 3007;

async function bootstrap() {
  try {
    await connectDatabase();

    const redis = createRedisClient();

    const blockingService = new BlockingService(redis);
    const auditLogger = new AuditLoggerService();
    const patternDetector = new PatternDetectorService(
      redis,
      blockingService,
      auditLogger
    );

    const controller = new AbuseController(
      patternDetector,
      blockingService,
      auditLogger
    );

    const app = express();
    app.use(express.json());
    app.use(requestLogger);
    app.use('/api/v1', createAbuseRoutes(controller));
    app.get('/health', (_req, res) => {
      res.json({ status: 'OK', service: 'abuse-detection-service' });
    });
    app.use(errorHandler);

    app.listen(PORT, () => {
      logger.info(`Abuse Detection Service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Abuse Detection Service', { error });
    process.exit(1);
  }
}

bootstrap();
