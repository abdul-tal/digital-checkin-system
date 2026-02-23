import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { createGatewayRoutes } from './routes/gateway.routes';
import { createAuthRoutes } from './routes/auth.routes';
import { errorHandler } from '../shared/middleware/error-handler';
import { requestLogger } from '../shared/middleware/request-logger';

export const createApp = (authService: AuthService): Express => {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ],
    credentials: true,
  }));
  app.use(compression());

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(requestLogger);

  const authController = new AuthController(authService);
  app.use('/api/v1', createAuthRoutes(authController));

  app.use('/api/v1', createGatewayRoutes(authService));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'OK',
      service: 'api-gateway',
      timestamp: new Date(),
    });
  });

  app.use(errorHandler);

  return app;
};
