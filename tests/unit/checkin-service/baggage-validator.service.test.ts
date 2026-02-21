import { BaggageValidatorService } from '../../../src/checkin-service/services/baggage-validator.service';
import { WeightServiceClient } from '../../../src/checkin-service/clients/weight-service.client';

jest.mock('../../../src/checkin-service/clients/weight-service.client');

describe('BaggageValidatorService', () => {
  let baggageValidator: BaggageValidatorService;
  let mockWeightClient: jest.Mocked<WeightServiceClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWeightClient = new WeightServiceClient() as jest.Mocked<WeightServiceClient>;
    baggageValidator = new BaggageValidatorService(mockWeightClient);
  });

  describe('validate', () => {
    it('should validate bags within weight limit (under 25kg)', async () => {
      mockWeightClient.weighBag.mockResolvedValueOnce(20);
      mockWeightClient.weighBag.mockResolvedValueOnce(22);

      const result = await baggageValidator.validate(2);

      expect(result.valid).toBe(true);
      expect(result.totalFee).toBe(0);
      expect(result.bags).toHaveLength(2);
      expect(result.bags[0].status).toBe('OK');
      expect(result.bags[1].status).toBe('OK');
    });

    it('should calculate fees for overweight bags (25-28kg)', async () => {
      mockWeightClient.weighBag.mockResolvedValueOnce(26);
      mockWeightClient.weighBag.mockResolvedValueOnce(27);

      const result = await baggageValidator.validate(2);

      expect(result.valid).toBe(true);
      expect(result.totalFee).toBe(100); // 50 + 50
      expect(result.bags[0].status).toBe('OVERWEIGHT');
      expect(result.bags[0].fee).toBe(50);
      expect(result.bags[1].status).toBe('OVERWEIGHT');
      expect(result.bags[1].fee).toBe(50);
    });

    it('should calculate higher fees for very overweight bags (28-32kg)', async () => {
      mockWeightClient.weighBag.mockResolvedValueOnce(29);
      mockWeightClient.weighBag.mockResolvedValueOnce(31);

      const result = await baggageValidator.validate(2);

      expect(result.valid).toBe(true);
      expect(result.totalFee).toBe(200); // 100 + 100
      expect(result.bags[0].status).toBe('OVERWEIGHT');
      expect(result.bags[0].fee).toBe(100);
      expect(result.bags[1].status).toBe('OVERWEIGHT');
      expect(result.bags[1].fee).toBe(100);
    });

    it('should reject bags over maximum weight (>32kg)', async () => {
      mockWeightClient.weighBag.mockResolvedValueOnce(33);
      mockWeightClient.weighBag.mockResolvedValueOnce(20);

      const result = await baggageValidator.validate(2);

      expect(result.valid).toBe(false);
      expect(result.bags[0].status).toBe('REJECTED');
      expect(result.bags[0].reason).toContain('Exceeds maximum weight limit');
      expect(result.bags[1].status).toBe('OK');
    });

    it('should handle mixed bag weights correctly', async () => {
      mockWeightClient.weighBag.mockResolvedValueOnce(20); // OK
      mockWeightClient.weighBag.mockResolvedValueOnce(26); // Overweight
      mockWeightClient.weighBag.mockResolvedValueOnce(24); // OK

      const result = await baggageValidator.validate(3);

      expect(result.valid).toBe(true);
      expect(result.totalFee).toBe(50);
      expect(result.bags[0].status).toBe('OK');
      expect(result.bags[1].status).toBe('OVERWEIGHT');
      expect(result.bags[2].status).toBe('OK');
    });

    it('should handle zero bags', async () => {
      const result = await baggageValidator.validate(0);

      expect(result.valid).toBe(true);
      expect(result.totalFee).toBe(0);
      expect(result.bags).toHaveLength(0);
      expect(mockWeightClient.weighBag).not.toHaveBeenCalled();
    });

    it('should validate each bag with unique bagId', async () => {
      mockWeightClient.weighBag.mockResolvedValue(20);

      await baggageValidator.validate(3);

      expect(mockWeightClient.weighBag).toHaveBeenCalledTimes(3);
      const bagIds = mockWeightClient.weighBag.mock.calls.map(call => call[0]);
      
      // All bagIds should be unique
      const uniqueBagIds = new Set(bagIds);
      expect(uniqueBagIds.size).toBe(3);
      
      // All bagIds should start with 'bag-'
      bagIds.forEach(bagId => {
        expect(bagId).toMatch(/^bag-\d+-\d+$/);
      });
    });
  });

  describe('fee calculation', () => {
    it('should return correct fees for different weight ranges', async () => {
      const testCases = [
        { weight: 24, expectedFee: 0 },
        { weight: 25, expectedFee: 0 },
        { weight: 26, expectedFee: 50 },
        { weight: 28, expectedFee: 50 },
        { weight: 29, expectedFee: 100 },
        { weight: 32, expectedFee: 100 },
      ];

      for (const { weight, expectedFee } of testCases) {
        mockWeightClient.weighBag.mockResolvedValueOnce(weight);
        
        const result = await baggageValidator.validate(1);
        
        expect(result.bags[0].fee).toBe(expectedFee);
      }
    });
  });
});
