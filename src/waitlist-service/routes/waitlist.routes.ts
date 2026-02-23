import { Router } from 'express';
import { WaitlistController } from '../controllers/waitlist.controller';

export const createWaitlistRoutes = (controller: WaitlistController): Router => {
  const router = Router();

  router.post('/waitlist/join', controller.joinWaitlist);
  router.delete('/waitlist/:waitlistId', controller.leaveWaitlist);

  return router;
};
