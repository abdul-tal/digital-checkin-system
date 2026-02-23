import { Router } from 'express';
import { CheckInController } from '../controllers/checkin.controller';

export const createCheckInRoutes = (controller: CheckInController): Router => {
  const router = Router();

  router.post('/checkin/start', controller.startCheckIn);
  router.post('/checkin/complete', controller.completeCheckIn);
  router.get('/checkin/:checkInId', controller.getCheckIn);
  router.post('/checkin/:checkInId/cancel', controller.cancelCheckIn);

  return router;
};
