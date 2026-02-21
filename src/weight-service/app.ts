import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createWeightRoutes } from './routes/weight.routes';
import { WeightController } from './controllers/weight.controller';
import { errorHandler } from '../shared/middleware/error-handler';

export const createApp = (controller: WeightController): Express => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use('/api/v1', createWeightRoutes(controller));

  app.get('/health', (_req, res) => {
    res.json({ status: 'OK', service: 'weight-service' });
  });

  app.use(errorHandler);

  return app;
};
