import { LoyaltyTier } from '../../shared/types/common.types';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('priority-calculator');

export interface CalculatePriorityRequest {
  loyaltyTier: LoyaltyTier;
  bookingTimestamp: Date;
  hasSpecialNeeds?: boolean;
}

export class PriorityCalculatorService {
  calculate(req: CalculatePriorityRequest): number {
    let score = 0;

    const tierScores: Record<LoyaltyTier, number> = {
      [LoyaltyTier.PLATINUM]: 400,
      [LoyaltyTier.GOLD]: 300,
      [LoyaltyTier.SILVER]: 200,
      [LoyaltyTier.REGULAR]: 100,
    };
    score += tierScores[req.loyaltyTier] || 100;

    const daysAgo = Math.floor(
      (Date.now() - req.bookingTimestamp.getTime()) / (1000 * 60 * 60 * 24)
    );
    const bookingPoints = Math.min(400, daysAgo * 10);
    score += bookingPoints;

    if (req.hasSpecialNeeds) {
      score += 200;
    }

    logger.debug('Priority calculated', {
      loyaltyTier: req.loyaltyTier,
      daysAgo,
      hasSpecialNeeds: req.hasSpecialNeeds,
      totalScore: score,
    });

    return score;
  }

  estimateWaitTime(position: number): string {
    if (position === 1) return '5-10 minutes';
    if (position <= 3) return '15-30 minutes';
    if (position <= 5) return '30-60 minutes';
    return '1-2 hours';
  }
}
