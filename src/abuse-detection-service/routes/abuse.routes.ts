import { Router } from 'express';
import { AbuseController } from '../controllers/abuse.controller';

export const createAbuseRoutes = (controller: AbuseController): Router => {
  const router = Router();

  router.post('/abuse/check', controller.checkAccess);
  router.post('/abuse/unblock', controller.unblock);
  router.get('/abuse/activity/:identifier', controller.getActivity);
  router.get('/abuse/blocked', controller.getBlocked);

  return router;
};
