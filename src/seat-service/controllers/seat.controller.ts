import { Request, Response, NextFunction } from 'express';
import { SeatHoldService } from '../services/seat-hold.service';
import { SeatManagementService } from '../services/seat-management.service';

export class SeatController {
  constructor(
    private seatHoldService: SeatHoldService,
    private seatManagementService: SeatManagementService
  ) {}

  getSeatMap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { flightId } = req.params;
      const seatMap = await this.seatManagementService.getSeatMap(flightId);

      res.json(seatMap);
    } catch (error) {
      next(error);
    }
  };

  holdSeat = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { flightId, seatId, passengerId } = req.body;

      const result = await this.seatHoldService.holdSeat({
        flightId,
        seatId,
        passengerId,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  releaseSeat = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { seatId, flightId } = req.body;

      await this.seatHoldService.releaseSeat(seatId, flightId);

      res.json({
        message: 'Seat released successfully',
        seatId,
        state: 'AVAILABLE',
      });
    } catch (error) {
      next(error);
    }
  };

  confirmSeat = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { seatId, flightId, passengerId } = req.body;

      await this.seatHoldService.confirmSeat(seatId, flightId, passengerId);

      res.json({
        message: 'Seat confirmed successfully',
        seatId,
        state: 'CONFIRMED',
      });
    } catch (error) {
      next(error);
    }
  };
}
