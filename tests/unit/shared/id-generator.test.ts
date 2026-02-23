import {
  generateId,
  generateCheckInId,
  generateHoldId,
  generatePaymentId,
  generateWaitlistId,
} from '../../../src/shared/utils/id-generator';

describe('ID Generator', () => {
  describe('generateId', () => {
    it('should generate a UUID without prefix', () => {
      const id = generateId();

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBe(36);
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate a UUID with prefix', () => {
      const id = generateId('test');

      expect(id).toMatch(/^test_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).not.toBe(id2);
    });

    it('should generate unique IDs with same prefix', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');

      expect(id1).not.toBe(id2);
      expect(id1.startsWith('test_')).toBe(true);
      expect(id2.startsWith('test_')).toBe(true);
    });
  });

  describe('generateCheckInId', () => {
    it('should generate ID with ci prefix', () => {
      const id = generateCheckInId();

      expect(id).toMatch(/^ci_[0-9a-f]{8}-/);
    });

    it('should generate unique check-in IDs', () => {
      const id1 = generateCheckInId();
      const id2 = generateCheckInId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('generateHoldId', () => {
    it('should generate ID with hold prefix', () => {
      const id = generateHoldId();

      expect(id).toMatch(/^hold_[0-9a-f]{8}-/);
    });
  });

  describe('generatePaymentId', () => {
    it('should generate ID with pay prefix', () => {
      const id = generatePaymentId();

      expect(id).toMatch(/^pay_[0-9a-f]{8}-/);
    });
  });

  describe('generateWaitlistId', () => {
    it('should generate ID with wl prefix', () => {
      const id = generateWaitlistId();

      expect(id).toMatch(/^wl_[0-9a-f]{8}-/);
    });
  });
});
