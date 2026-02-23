import {
  addSeconds,
  addMinutes,
  addHours,
  isExpired,
  getRemainingSeconds,
  formatTimestamp,
} from '../../../src/shared/utils/date-utils';

describe('Date Utils', () => {
  describe('addSeconds', () => {
    it('should add seconds to a date', () => {
      const date = new Date('2026-02-21T10:00:00Z');
      const result = addSeconds(date, 30);

      expect(result.toISOString()).toBe('2026-02-21T10:00:30.000Z');
    });

    it('should handle negative seconds', () => {
      const date = new Date('2026-02-21T10:00:30Z');
      const result = addSeconds(date, -30);

      expect(result.toISOString()).toBe('2026-02-21T10:00:00.000Z');
    });

    it('should not mutate original date', () => {
      const date = new Date('2026-02-21T10:00:00Z');
      const original = date.toISOString();
      addSeconds(date, 30);

      expect(date.toISOString()).toBe(original);
    });
  });

  describe('addMinutes', () => {
    it('should add minutes to a date', () => {
      const date = new Date('2026-02-21T10:00:00Z');
      const result = addMinutes(date, 5);

      expect(result.toISOString()).toBe('2026-02-21T10:05:00.000Z');
    });

    it('should handle large minute values', () => {
      const date = new Date('2026-02-21T10:00:00Z');
      const result = addMinutes(date, 120);

      expect(result.toISOString()).toBe('2026-02-21T12:00:00.000Z');
    });
  });

  describe('addHours', () => {
    it('should add hours to a date', () => {
      const date = new Date('2026-02-21T10:00:00Z');
      const result = addHours(date, 2);

      expect(result.toISOString()).toBe('2026-02-21T12:00:00.000Z');
    });

    it('should handle adding hours across day boundary', () => {
      const date = new Date('2026-02-21T23:00:00Z');
      const result = addHours(date, 2);

      expect(result.toISOString()).toBe('2026-02-22T01:00:00.000Z');
    });
  });

  describe('isExpired', () => {
    it('should return true for past dates', () => {
      const pastDate = new Date('2020-01-01T00:00:00Z');

      expect(isExpired(pastDate)).toBe(true);
    });

    it('should return false for future dates', () => {
      const futureDate = new Date('2030-01-01T00:00:00Z');

      expect(isExpired(futureDate)).toBe(false);
    });

    it('should return true for dates just expired', () => {
      const justExpired = new Date(Date.now() - 1000);

      expect(isExpired(justExpired)).toBe(true);
    });

    it('should return false for dates not yet expired', () => {
      const notExpired = new Date(Date.now() + 1000);

      expect(isExpired(notExpired)).toBe(false);
    });
  });

  describe('getRemainingSeconds', () => {
    it('should return remaining seconds for future date', () => {
      const futureDate = new Date(Date.now() + 60000);
      const remaining = getRemainingSeconds(futureDate);

      expect(remaining).toBeGreaterThanOrEqual(59);
      expect(remaining).toBeLessThanOrEqual(60);
    });

    it('should return 0 for expired dates', () => {
      const pastDate = new Date('2020-01-01T00:00:00Z');
      const remaining = getRemainingSeconds(pastDate);

      expect(remaining).toBe(0);
    });

    it('should return 0 for dates just expired', () => {
      const justExpired = new Date(Date.now() - 1000);
      const remaining = getRemainingSeconds(justExpired);

      expect(remaining).toBe(0);
    });

    it('should handle dates with milliseconds', () => {
      const futureDate = new Date(Date.now() + 5500);
      const remaining = getRemainingSeconds(futureDate);

      expect(remaining).toBeGreaterThanOrEqual(5);
      expect(remaining).toBeLessThanOrEqual(6);
    });
  });

  describe('formatTimestamp', () => {
    it('should format date as ISO string', () => {
      const date = new Date('2026-02-21T10:30:45.123Z');
      const formatted = formatTimestamp(date);

      expect(formatted).toBe('2026-02-21T10:30:45.123Z');
    });

    it('should handle different dates consistently', () => {
      const date1 = new Date('2026-01-01T00:00:00Z');
      const date2 = new Date('2026-12-31T23:59:59Z');

      expect(formatTimestamp(date1)).toBe('2026-01-01T00:00:00.000Z');
      expect(formatTimestamp(date2)).toBe('2026-12-31T23:59:59.000Z');
    });
  });
});
