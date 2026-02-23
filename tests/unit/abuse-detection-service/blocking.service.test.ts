import { BlockingService, BlockRequest } from '../../../src/abuse-detection-service/services/blocking.service';
import Redis from 'ioredis';

jest.mock('ioredis');
jest.mock('../../../src/shared/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('BlockingService', () => {
  let blockingService: BlockingService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    } as any;

    blockingService = new BlockingService(mockRedis);
  });

  describe('block', () => {
    it('should block identifier with reason and duration', async () => {
      const blockRequest: BlockRequest = {
        identifier: 'U_attacker',
        reason: 'RAPID_SEAT_MAP_ACCESS',
        duration: 300,
        metadata: { count: 55, threshold: 50 },
      };

      await blockingService.block(blockRequest);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'blocked:U_attacker',
        300,
        expect.stringContaining('RAPID_SEAT_MAP_ACCESS')
      );

      const callArgs = (mockRedis.setex as jest.Mock).mock.calls[0];
      const storedData = JSON.parse(callArgs[2]);
      expect(storedData).toMatchObject({
        reason: 'RAPID_SEAT_MAP_ACCESS',
        metadata: { count: 55, threshold: 50 },
      });
      expect(storedData.blockedAt).toBeDefined();
    });

    it('should store block data as JSON string', async () => {
      const blockRequest: BlockRequest = {
        identifier: 'IP_192.168.1.100',
        reason: 'HOLD_SPAM',
        duration: 600,
      };

      await blockingService.block(blockRequest);

      const callArgs = (mockRedis.setex as jest.Mock).mock.calls[0];
      const storedData = JSON.parse(callArgs[2]);
      expect(typeof storedData).toBe('object');
      expect(storedData.reason).toBe('HOLD_SPAM');
    });

    it('should set correct TTL for block', async () => {
      const blockRequest: BlockRequest = {
        identifier: 'U_test',
        reason: 'TEST_BLOCK',
        duration: 120,
      };

      await blockingService.block(blockRequest);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'blocked:U_test',
        120,
        expect.any(String)
      );
    });

    it('should handle blocks without metadata', async () => {
      const blockRequest: BlockRequest = {
        identifier: 'U_test',
        reason: 'SUSPICIOUS_ACTIVITY',
        duration: 300,
      };

      await blockingService.block(blockRequest);

      const callArgs = (mockRedis.setex as jest.Mock).mock.calls[0];
      const storedData = JSON.parse(callArgs[2]);
      expect(storedData.metadata).toBeUndefined();
    });

    it('should use correct Redis key format', async () => {
      const blockRequest: BlockRequest = {
        identifier: 'test-identifier',
        reason: 'TEST',
        duration: 60,
      };

      await blockingService.block(blockRequest);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'blocked:test-identifier',
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe('isBlocked', () => {
    it('should return true when identifier is blocked', async () => {
      const blockData = JSON.stringify({
        reason: 'RAPID_ACCESS',
        blockedAt: new Date().toISOString(),
      });
      mockRedis.get.mockResolvedValue(blockData);

      const result = await blockingService.isBlocked('U_blocked');

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('blocked:U_blocked');
    });

    it('should return false when identifier is not blocked', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await blockingService.isBlocked('U_notblocked');

      expect(result).toBe(false);
      expect(mockRedis.get).toHaveBeenCalledWith('blocked:U_notblocked');
    });

    it('should return false when Redis returns empty string', async () => {
      mockRedis.get.mockResolvedValue('');

      const result = await blockingService.isBlocked('U_test');

      expect(result).toBe(false);
    });

    it('should use correct Redis key format', async () => {
      await blockingService.isBlocked('test-id-123');

      expect(mockRedis.get).toHaveBeenCalledWith('blocked:test-id-123');
    });
  });

  describe('unblock', () => {
    it('should remove block for identifier', async () => {
      mockRedis.del.mockResolvedValue(1);

      await blockingService.unblock('U_attacker');

      expect(mockRedis.del).toHaveBeenCalledWith('blocked:U_attacker');
    });

    it('should handle unblocking non-blocked identifier', async () => {
      mockRedis.del.mockResolvedValue(0);

      await blockingService.unblock('U_never_blocked');

      expect(mockRedis.del).toHaveBeenCalledWith('blocked:U_never_blocked');
    });

    it('should use correct Redis key format', async () => {
      await blockingService.unblock('test-identifier');

      expect(mockRedis.del).toHaveBeenCalledWith('blocked:test-identifier');
    });
  });

  describe('requireCaptcha', () => {
    it('should set CAPTCHA requirement for user', async () => {
      await blockingService.requireCaptcha('U_spammer');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'captcha_required:U_spammer',
        3600,
        'true'
      );
    });

    it('should set 1 hour TTL for CAPTCHA requirement', async () => {
      await blockingService.requireCaptcha('U_test');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        3600,
        'true'
      );
    });

    it('should use correct Redis key format', async () => {
      await blockingService.requireCaptcha('test-user-id');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'captcha_required:test-user-id',
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe('requiresCaptcha', () => {
    it('should return true when CAPTCHA is required', async () => {
      mockRedis.get.mockResolvedValue('true');

      const result = await blockingService.requiresCaptcha('U_spammer');

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('captcha_required:U_spammer');
    });

    it('should return false when CAPTCHA is not required', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await blockingService.requiresCaptcha('U_normal');

      expect(result).toBe(false);
      expect(mockRedis.get).toHaveBeenCalledWith('captcha_required:U_normal');
    });

    it('should return false for empty string', async () => {
      mockRedis.get.mockResolvedValue('');

      const result = await blockingService.requiresCaptcha('U_test');

      expect(result).toBe(false);
    });

    it('should use correct Redis key format', async () => {
      await blockingService.requiresCaptcha('test-user');

      expect(mockRedis.get).toHaveBeenCalledWith('captcha_required:test-user');
    });
  });

  describe('clearCaptcha', () => {
    it('should remove CAPTCHA requirement', async () => {
      mockRedis.del.mockResolvedValue(1);

      await blockingService.clearCaptcha('U_spammer');

      expect(mockRedis.del).toHaveBeenCalledWith('captcha_required:U_spammer');
    });

    it('should handle clearing non-existent CAPTCHA requirement', async () => {
      mockRedis.del.mockResolvedValue(0);

      await blockingService.clearCaptcha('U_test');

      expect(mockRedis.del).toHaveBeenCalledWith('captcha_required:U_test');
    });

    it('should use correct Redis key format', async () => {
      await blockingService.clearCaptcha('test-user-id');

      expect(mockRedis.del).toHaveBeenCalledWith('captcha_required:test-user-id');
    });
  });
});
