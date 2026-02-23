import { Request, Response, NextFunction } from 'express';
import { WaitlistManagerService } from '../services/waitlist-manager.service';
import { LoyaltyTier } from '../../shared/types/common.types';

export class WaitlistController {
  constructor(private waitlistManager: WaitlistManagerService) {}

  joinWaitlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        passengerId,
        checkInId,
        userId,
        flightId,
        seatId,
        loyaltyTier,
        bookingTimestamp,
        hasSpecialNeeds,
        baggage,
      } = req.body;

      const result = await this.waitlistManager.joinWaitlist({
        passengerId,
        checkInId,
        userId,
        flightId,
        seatId,
        loyaltyTier: loyaltyTier as LoyaltyTier,
        bookingTimestamp: new Date(bookingTimestamp || Date.now()),
        hasSpecialNeeds,
        baggage,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  leaveWaitlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { waitlistId } = req.params;
      const { passengerId } = req.body;

      await this.waitlistManager.leaveWaitlist(waitlistId, passengerId);

      res.json({
        message: 'Removed from waitlist successfully',
        waitlistId,
      });
    } catch (error) {
      next(error);
    }
  };
}
