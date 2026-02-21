import { Router } from 'express';
import { SeatController } from '../controllers/seat.controller';
import { validateHoldRequest, validateReleaseRequest } from '../validators/seat.validator';

export const createSeatRoutes = (controller: SeatController): Router => {
  const router = Router();

  // Get seat map
  router.get('/flights/:flightId/seatmap', controller.getSeatMap);

  // Hold seat
  router.post('/seats/hold', validateHoldRequest, controller.holdSeat);

  // Release seat
  router.post('/seats/release', validateReleaseRequest, controller.releaseSeat);

  // Confirm seat (internal API)
  router.post('/seats/confirm', controller.confirmSeat);

  return router;
};
