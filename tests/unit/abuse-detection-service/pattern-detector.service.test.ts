import { PatternDetectorService, CheckAccessRequest } from '../../../src/abuse-detection-service/services/pattern-detector.service';
import { BlockingService } from '../../../src/abuse-detection-service/services/blocking.service';
import { AuditLoggerService } from '../../../src/abuse-detection-service/services/audit-logger.service';
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

describe('PatternDetectorService', () => {
  let patternDetector: PatternDetectorService;
  let mockRedis: jest.Mocked<Redis>;
  let mockBlockingService: jest.Mocked<BlockingService>;
  let mockAuditLogger: jest.Mocked<AuditLoggerService>;

  beforeEach(() => {
    mockRedis = {
      incr: jest.fn().mockResolvedValue(1),
      pexpire: jest.fn().mockResolvedValue(1),
    } as any;

    mockBlockingService = {
      block: jest.fn().mockResolvedValue(undefined),
      isBlocked: jest.fn().mockResolvedValue(false),
      unblock: jest.fn().mockResolvedValue(undefined),
      requireCaptcha: jest.fn().mockResolvedValue(undefined),
      requiresCaptcha: jest.fn().mockResolvedValue(false),
      clearCaptcha: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockAuditLogger = {
      log: jest.fn().mockResolvedValue(undefined),
      getRecentActivity: jest.fn().mockResolvedValue([]),
      getBlockedIdentifiers: jest.fn().mockResolvedValue([]),
    } as any;

    patternDetector = new PatternDetectorService(
      mockRedis,
      mockBlockingService,
      mockAuditLogger
    );
  });

  describe('checkRapidSeatMapAccess', () => {
    it('should not block when access count is below threshold', async () => {
      mockRedis.incr.mockResolvedValue(10);

      const request: CheckAccessRequest = {
        userId: 'U_normal',
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      };

      const result = await patternDetector.checkRapidSeatMapAccess(request);

      expect(result).toBe(false);
      expect(mockBlockingService.block).not.toHaveBeenCalled();
      expect(mockAuditLogger.log).not.toHaveBeenCalled();
    });

    it('should block when access count exceeds threshold', async () => {
      mockRedis.incr.mockResolvedValue(51);

      const request: CheckAccessRequest = {
        userId: 'U_attacker',
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      };

      const result = await patternDetector.checkRapidSeatMapAccess(request);

      expect(result).toBe(true);
      expect(mockBlockingService.block).toHaveBeenCalledWith({
        identifier: 'U_attacker',
        reason: 'RAPID_SEAT_MAP_ACCESS',
        duration: 300,
        metadata: { count: 51, threshold: 50 },
      });
      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        identifier: 'U_attacker',
        action: 'BLOCKED',
        reason: 'Rapid seat map access detected',
        metadata: { count: 51, threshold: 50 },
      });
    });

    it('should use userId as identifier when provided', async () => {
      mockRedis.incr.mockResolvedValue(1);

      const request: CheckAccessRequest = {
        userId: 'U_user123',
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      };

      await patternDetector.checkRapidSeatMapAccess(request);

      expect(mockRedis.incr).toHaveBeenCalledWith('seatmap_access:U_user123');
    });

    it('should use IP as identifier when userId is not provided', async () => {
      mockRedis.incr.mockResolvedValue(1);

      const request: CheckAccessRequest = {
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      };

      await patternDetector.checkRapidSeatMapAccess(request);

      expect(mockRedis.incr).toHaveBeenCalledWith('seatmap_access:192.168.1.100');
    });

    it('should set expiry on first access', async () => {
      mockRedis.incr.mockResolvedValue(1);

      const request: CheckAccessRequest = {
        userId: 'U_user',
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      };

      await patternDetector.checkRapidSeatMapAccess(request);

      expect(mockRedis.pexpire).toHaveBeenCalledWith('seatmap_access:U_user', 2000);
    });

    it('should not set expiry on subsequent accesses', async () => {
      mockRedis.incr.mockResolvedValue(5);

      const request: CheckAccessRequest = {
        userId: 'U_user',
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      };

      await patternDetector.checkRapidSeatMapAccess(request);

      expect(mockRedis.pexpire).not.toHaveBeenCalled();
    });

    it('should block exactly at threshold', async () => {
      mockRedis.incr.mockResolvedValue(50);

      const request: CheckAccessRequest = {
        userId: 'U_user',
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      };

      const result = await patternDetector.checkRapidSeatMapAccess(request);

      expect(result).toBe(false);
      expect(mockBlockingService.block).not.toHaveBeenCalled();
    });

    it('should block at threshold + 1', async () => {
      mockRedis.incr.mockResolvedValue(51);

      const request: CheckAccessRequest = {
        userId: 'U_user',
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      };

      const result = await patternDetector.checkRapidSeatMapAccess(request);

      expect(result).toBe(true);
      expect(mockBlockingService.block).toHaveBeenCalled();
    });
  });

  describe('checkHoldSpam', () => {
    it('should not require CAPTCHA when hold count is below threshold', async () => {
      mockRedis.incr.mockResolvedValue(5);

      const result = await patternDetector.checkHoldSpam('U_normal');

      expect(result).toBe(false);
      expect(mockBlockingService.requireCaptcha).not.toHaveBeenCalled();
      expect(mockAuditLogger.log).not.toHaveBeenCalled();
    });

    it('should require CAPTCHA when hold count exceeds threshold', async () => {
      mockRedis.incr.mockResolvedValue(11);

      const result = await patternDetector.checkHoldSpam('U_spammer');

      expect(result).toBe(true);
      expect(mockBlockingService.requireCaptcha).toHaveBeenCalledWith('U_spammer');
      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        identifier: 'U_spammer',
        action: 'CAPTCHA_REQUIRED',
        reason: 'Rapid hold/release detected',
        metadata: { count: 11, threshold: 10 },
      });
    });

    it('should use correct Redis key format', async () => {
      mockRedis.incr.mockResolvedValue(1);

      await patternDetector.checkHoldSpam('U_user123');

      expect(mockRedis.incr).toHaveBeenCalledWith('hold_spam:U_user123');
    });

    it('should set expiry on first hold attempt', async () => {
      mockRedis.incr.mockResolvedValue(1);

      await patternDetector.checkHoldSpam('U_user');

      expect(mockRedis.pexpire).toHaveBeenCalledWith('hold_spam:U_user', 300000);
    });

    it('should not set expiry on subsequent hold attempts', async () => {
      mockRedis.incr.mockResolvedValue(3);

      await patternDetector.checkHoldSpam('U_user');

      expect(mockRedis.pexpire).not.toHaveBeenCalled();
    });

    it('should not require CAPTCHA at threshold', async () => {
      mockRedis.incr.mockResolvedValue(10);

      const result = await patternDetector.checkHoldSpam('U_user');

      expect(result).toBe(false);
      expect(mockBlockingService.requireCaptcha).not.toHaveBeenCalled();
    });

    it('should require CAPTCHA at threshold + 1', async () => {
      mockRedis.incr.mockResolvedValue(11);

      const result = await patternDetector.checkHoldSpam('U_user');

      expect(result).toBe(true);
      expect(mockBlockingService.requireCaptcha).toHaveBeenCalled();
    });
  });

  describe('isBlocked', () => {
    it('should delegate to blocking service', async () => {
      mockBlockingService.isBlocked.mockResolvedValue(true);

      const result = await patternDetector.isBlocked('U_blocked');

      expect(result).toBe(true);
      expect(mockBlockingService.isBlocked).toHaveBeenCalledWith('U_blocked');
    });

    it('should return false when not blocked', async () => {
      mockBlockingService.isBlocked.mockResolvedValue(false);

      const result = await patternDetector.isBlocked('U_notblocked');

      expect(result).toBe(false);
    });
  });

  describe('requiresCaptcha', () => {
    it('should delegate to blocking service', async () => {
      mockBlockingService.requiresCaptcha.mockResolvedValue(true);

      const result = await patternDetector.requiresCaptcha('U_spammer');

      expect(result).toBe(true);
      expect(mockBlockingService.requiresCaptcha).toHaveBeenCalledWith('U_spammer');
    });

    it('should return false when CAPTCHA not required', async () => {
      mockBlockingService.requiresCaptcha.mockResolvedValue(false);

      const result = await patternDetector.requiresCaptcha('U_normal');

      expect(result).toBe(false);
    });
  });

  describe('thresholds', () => {
    it('should use correct rapid seat map threshold (50)', async () => {
      mockRedis.incr.mockResolvedValue(51);

      await patternDetector.checkRapidSeatMapAccess({
        userId: 'U_user',
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      });

      expect(mockBlockingService.block).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { count: 51, threshold: 50 },
        })
      );
    });

    it('should use correct hold spam threshold (10)', async () => {
      mockRedis.incr.mockResolvedValue(11);

      await patternDetector.checkHoldSpam('U_user');

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { count: 11, threshold: 10 },
        })
      );
    });

    it('should use correct seat map window (2 seconds)', async () => {
      mockRedis.incr.mockResolvedValue(1);

      await patternDetector.checkRapidSeatMapAccess({
        userId: 'U_user',
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      });

      expect(mockRedis.pexpire).toHaveBeenCalledWith(expect.any(String), 2000);
    });

    it('should use correct hold spam window (5 minutes)', async () => {
      mockRedis.incr.mockResolvedValue(1);

      await patternDetector.checkHoldSpam('U_user');

      expect(mockRedis.pexpire).toHaveBeenCalledWith(expect.any(String), 300000);
    });
  });
});
