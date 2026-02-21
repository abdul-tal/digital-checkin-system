import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createSeatRoutes } from './routes/seat.routes';
import { SeatController } from './controllers/seat.controller';
import { errorHandler } from '../shared/middleware/error-handler';
import { requestLogger } from '../shared/middleware/request-logger';

export const createApp = (controller: SeatController): Express => {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json());
  app.use(requestLogger);

  // Routes
  app.use('/api/v1', createSeatRoutes(controller));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'OK', service: 'seat-service', timestamp: new Date() });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
};
