import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createPaymentRoutes } from './routes/payment.routes';
import { PaymentController } from './controllers/payment.controller';
import { errorHandler } from '../shared/middleware/error-handler';

export const createApp = (controller: PaymentController): Express => {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());

  app.use('/api/v1', createPaymentRoutes(controller));
  app.use('/', createPaymentRoutes(controller));

  app.get('/health', (_req, res) => {
    res.json({ status: 'OK', service: 'payment-service' });
  });

  app.use(errorHandler);

  return app;
};
