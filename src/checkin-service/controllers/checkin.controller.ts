import { Request, Response, NextFunction } from 'express';
import { CheckInOrchestratorService } from '../services/checkin-orchestrator.service';

export class CheckInController {
  constructor(private orchestrator: CheckInOrchestratorService) {}

  startCheckIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { passengerId, userId, bookingId } = req.body;
      const result = await this.orchestrator.startCheckIn({
        passengerId,
        userId,
        bookingId,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  completeCheckIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { checkInId, passengerId, userId, seatId, baggage } = req.body;
      const result = await this.orchestrator.completeCheckIn({
        checkInId,
        passengerId,
        userId,
        seatId,
        baggage,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  cancelCheckIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { checkInId } = req.params;
      const { passengerId } = req.body;
      const result = await this.orchestrator.cancelCheckIn(checkInId, passengerId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
