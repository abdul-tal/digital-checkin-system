import { MockWeightService } from '../../../src/weight-service/services/mock-weight.service';

describe('MockWeightService', () => {
  let weightService: MockWeightService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MOCK_WEIGHT_DELAY_MS = '10';
    weightService = new MockWeightService();
  });

  describe('weighBag', () => {
    it('should generate weight between 15-33kg', async () => {
      const results = [];
      
      for (let i = 0; i < 100; i++) {
        const result = await weightService.weighBag({ bagId: `bag-${i}` });
        results.push(result.weight);
      }

      results.forEach(weight => {
        expect(weight).toBeGreaterThanOrEqual(15);
        expect(weight).toBeLessThanOrEqual(33);
      });
    });

    it('should return weight with correct structure', async () => {
      const result = await weightService.weighBag({ bagId: 'bag-test-1' });

      expect(result).toEqual({
        bagId: 'bag-test-1',
        weight: expect.any(Number),
        measuredAt: expect.any(Date),
        unit: 'kg',
      });
    });

    it('should round weight to 1 decimal place', async () => {
      const result = await weightService.weighBag({ bagId: 'bag-test-1' });

      const decimalPlaces = result.weight.toString().split('.')[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(1);
    });

    it('should simulate measurement delay', async () => {
      const startTime = Date.now();
      await weightService.weighBag({ bagId: 'bag-test-1' });
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeGreaterThanOrEqual(10);
    });

    it('should follow realistic distribution over many samples', async () => {
      process.env.MOCK_WEIGHT_DELAY_MS = '0';
      const fastService = new MockWeightService();
      const results = [];
      
      for (let i = 0; i < 300; i++) {
        const result = await fastService.weighBag({ bagId: `bag-${i}` });
        results.push(result.weight);
      }

      const withinLimit = results.filter(w => w <= 25).length;
      const overweight = results.filter(w => w > 25 && w <= 30).length;
      const severe = results.filter(w => w > 30).length;

      // Allow 15% margin of error for smaller sample
      expect(withinLimit).toBeGreaterThan(180);  // ~60-80%
      expect(withinLimit).toBeLessThan(250);
      
      expect(overweight).toBeGreaterThan(30);    // ~10-30%
      expect(overweight).toBeLessThan(100);
      
      expect(severe).toBeGreaterThan(10);        // ~3-20%
      expect(severe).toBeLessThan(70);
    }, 15000);
  });

  describe('weighBagWithWeight', () => {
    it('should return exact weight specified', async () => {
      const result = await weightService.weighBagWithWeight('bag-test-1', 26.5);

      expect(result.weight).toBe(26.5);
      expect(result.bagId).toBe('bag-test-1');
    });

    it('should still simulate delay for fixed weight', async () => {
      const startTime = Date.now();
      await weightService.weighBagWithWeight('bag-test-1', 20);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeGreaterThanOrEqual(8);
    });

    it('should accept any weight value', async () => {
      const testWeights = [0, 5, 25, 32, 50, 100];

      for (const weight of testWeights) {
        const result = await weightService.weighBagWithWeight('bag-test', weight);
        expect(result.weight).toBe(weight);
      }
    });

    it('should return correct response structure', async () => {
      const result = await weightService.weighBagWithWeight('bag-fixed', 26.5);

      expect(result).toEqual({
        bagId: 'bag-fixed',
        weight: 26.5,
        measuredAt: expect.any(Date),
        unit: 'kg',
      });
    });
  });

  describe('configuration', () => {
    it('should respect custom delay configuration', async () => {
      process.env.MOCK_WEIGHT_DELAY_MS = '100';
      const customService = new MockWeightService();

      const startTime = Date.now();
      await customService.weighBag({ bagId: 'bag-test' });
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should default to 500ms delay if not configured', async () => {
      delete process.env.MOCK_WEIGHT_DELAY_MS;
      const defaultService = new MockWeightService();

      const startTime = Date.now();
      await defaultService.weighBag({ bagId: 'bag-test' });
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeGreaterThanOrEqual(500);
    });
  });
});
