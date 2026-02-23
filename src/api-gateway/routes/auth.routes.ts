import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

export const createAuthRoutes = (controller: AuthController): Router => {
  const router = Router();

  router.post('/auth/login', controller.login);
  router.post('/auth/logout', controller.logout);

  return router;
};
