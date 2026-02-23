import { PriorityCalculatorService } from '../../../src/waitlist-service/services/priority-calculator.service';
import { LoyaltyTier } from '../../../src/shared/types/common.types';

describe('PriorityCalculatorService', () => {
  let service: PriorityCalculatorService;

  beforeEach(() => {
    service = new PriorityCalculatorService();
  });

  describe('calculate', () => {
    it('should calculate score for REGULAR tier passenger', () => {
      const score = service.calculate({
        loyaltyTier: LoyaltyTier.REGULAR,
        bookingTimestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        hasSpecialNeeds: false,
      });

      expect(score).toBe(120);
    });

    it('should calculate score for SILVER tier passenger', () => {
      const score = service.calculate({
        loyaltyTier: LoyaltyTier.SILVER,
        bookingTimestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        hasSpecialNeeds: false,
      });

      expect(score).toBe(220);
    });

    it('should calculate score for GOLD tier passenger', () => {
      const score = service.calculate({
        loyaltyTier: LoyaltyTier.GOLD,
        bookingTimestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        hasSpecialNeeds: false,
      });

      expect(score).toBe(320);
    });

    it('should calculate score for PLATINUM tier passenger', () => {
      const score = service.calculate({
        loyaltyTier: LoyaltyTier.PLATINUM,
        bookingTimestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        hasSpecialNeeds: false,
      });

      expect(score).toBe(420);
    });

    it('should add booking time points (10 per day)', () => {
      const score = service.calculate({
        loyaltyTier: LoyaltyTier.REGULAR,
        bookingTimestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        hasSpecialNeeds: false,
      });

      expect(score).toBe(200);
    });

    it('should cap booking time points at 400', () => {
      const score = service.calculate({
        loyaltyTier: LoyaltyTier.REGULAR,
        bookingTimestamp: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        hasSpecialNeeds: false,
      });

      expect(score).toBe(500);
    });

    it('should add special needs bonus', () => {
      const score = service.calculate({
        loyaltyTier: LoyaltyTier.REGULAR,
        bookingTimestamp: new Date(),
        hasSpecialNeeds: true,
      });

      expect(score).toBe(300);
    });

    it('should calculate maximum possible score', () => {
      const score = service.calculate({
        loyaltyTier: LoyaltyTier.PLATINUM,
        bookingTimestamp: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        hasSpecialNeeds: true,
      });

      expect(score).toBe(1000);
    });

    it('should calculate minimum possible score', () => {
      const score = service.calculate({
        loyaltyTier: LoyaltyTier.REGULAR,
        bookingTimestamp: new Date(),
        hasSpecialNeeds: false,
      });

      expect(score).toBe(100);
    });

    it('should prioritize PLATINUM over GOLD with same booking time', () => {
      const bookingDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

      const goldScore = service.calculate({
        loyaltyTier: LoyaltyTier.GOLD,
        bookingTimestamp: bookingDate,
        hasSpecialNeeds: false,
      });

      const platinumScore = service.calculate({
        loyaltyTier: LoyaltyTier.PLATINUM,
        bookingTimestamp: bookingDate,
        hasSpecialNeeds: false,
      });

      expect(platinumScore).toBeGreaterThan(goldScore);
      expect(platinumScore - goldScore).toBe(100);
    });
  });

  describe('estimateWaitTime', () => {
    it('should estimate 5-10 minutes for position 1', () => {
      const estimate = service.estimateWaitTime(1);
      expect(estimate).toBe('5-10 minutes');
    });

    it('should estimate 15-30 minutes for positions 2-3', () => {
      expect(service.estimateWaitTime(2)).toBe('15-30 minutes');
      expect(service.estimateWaitTime(3)).toBe('15-30 minutes');
    });

    it('should estimate 30-60 minutes for positions 4-5', () => {
      expect(service.estimateWaitTime(4)).toBe('30-60 minutes');
      expect(service.estimateWaitTime(5)).toBe('30-60 minutes');
    });

    it('should estimate 1-2 hours for position 6+', () => {
      expect(service.estimateWaitTime(6)).toBe('1-2 hours');
      expect(service.estimateWaitTime(10)).toBe('1-2 hours');
      expect(service.estimateWaitTime(100)).toBe('1-2 hours');
    });
  });
});
