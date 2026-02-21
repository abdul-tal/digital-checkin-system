import { Router } from 'express';
import { WeightController } from '../controllers/weight.controller';

export const createWeightRoutes = (controller: WeightController): Router => {
  const router = Router();

  router.post('/baggage/weigh', controller.weighBag);

  return router;
};
