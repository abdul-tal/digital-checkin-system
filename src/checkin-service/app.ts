import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createCheckInRoutes } from './routes/checkin.routes';
import { CheckInController } from './controllers/checkin.controller';
import { errorHandler } from '../shared/middleware/error-handler';

export const createApp = (controller: CheckInController): Express => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use('/api/v1', createCheckInRoutes(controller));

  app.get('/health', (_req, res) => {
    res.json({ status: 'OK', service: 'checkin-service' });
  });

  app.use(errorHandler);

  return app;
};
