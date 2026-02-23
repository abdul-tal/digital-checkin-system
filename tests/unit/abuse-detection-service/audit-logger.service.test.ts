import { AuditLoggerService, LogAccessRequest } from '../../../src/abuse-detection-service/services/audit-logger.service';
import { AccessLog } from '../../../src/shared/models/access-log.model';

jest.mock('../../../src/shared/models/access-log.model');
jest.mock('../../../src/shared/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('AuditLoggerService', () => {
  let auditLogger: AuditLoggerService;
  let mockCreate: jest.Mock;
  let mockFind: jest.Mock;

  beforeEach(() => {
    mockCreate = jest.fn().mockResolvedValue({});
    mockFind = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
      distinct: jest.fn().mockResolvedValue([]),
    });

    (AccessLog.create as jest.Mock) = mockCreate;
    (AccessLog.find as jest.Mock) = mockFind;

    auditLogger = new AuditLoggerService();
  });

  describe('log', () => {
    it('should create access log entry with all fields', async () => {
      const logRequest: LogAccessRequest = {
        identifier: 'U_attacker',
        action: 'BLOCKED',
        reason: 'Rapid seat map access detected',
        metadata: { count: 55, threshold: 50 },
      };

      await auditLogger.log(logRequest);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'U_attacker',
          action: 'BLOCKED',
          reason: 'Rapid seat map access detected',
          metadata: { count: 55, threshold: 50 },
          timestamp: expect.any(Date),
        })
      );
    });

    it('should log SEAT_MAP_ACCESS action', async () => {
      const logRequest: LogAccessRequest = {
        identifier: 'U_user',
        action: 'SEAT_MAP_ACCESS',
      };

      await auditLogger.log(logRequest);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SEAT_MAP_ACCESS',
          metadata: {},
        })
      );
    });

    it('should log HOLD_SEAT action', async () => {
      const logRequest: LogAccessRequest = {
        identifier: 'U_user',
        action: 'HOLD_SEAT',
        metadata: { seatId: '10A' },
      };

      await auditLogger.log(logRequest);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'HOLD_SEAT',
          metadata: { seatId: '10A' },
        })
      );
    });

    it('should log CAPTCHA_REQUIRED action', async () => {
      const logRequest: LogAccessRequest = {
        identifier: 'U_spammer',
        action: 'CAPTCHA_REQUIRED',
        reason: 'Rapid hold/release detected',
        metadata: { count: 12, threshold: 10 },
      };

      await auditLogger.log(logRequest);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CAPTCHA_REQUIRED',
          reason: 'Rapid hold/release detected',
        })
      );
    });

    it('should use empty object for metadata if not provided', async () => {
      const logRequest: LogAccessRequest = {
        identifier: 'U_user',
        action: 'SEAT_MAP_ACCESS',
      };

      await auditLogger.log(logRequest);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {},
        })
      );
    });

    it('should set current timestamp', async () => {
      const beforeLog = new Date();
      
      await auditLogger.log({
        identifier: 'U_user',
        action: 'BLOCKED',
      });

      const afterLog = new Date();
      const loggedTimestamp = (mockCreate.mock.calls[0][0] as any).timestamp;

      expect(loggedTimestamp.getTime()).toBeGreaterThanOrEqual(beforeLog.getTime());
      expect(loggedTimestamp.getTime()).toBeLessThanOrEqual(afterLog.getTime());
    });

    it('should not throw error on database failure', async () => {
      mockCreate.mockRejectedValue(new Error('Database error'));

      await expect(
        auditLogger.log({
          identifier: 'U_user',
          action: 'BLOCKED',
        })
      ).resolves.not.toThrow();
    });

    it('should handle missing reason gracefully', async () => {
      const logRequest: LogAccessRequest = {
        identifier: 'U_user',
        action: 'SEAT_MAP_ACCESS',
      };

      await auditLogger.log(logRequest);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: undefined,
        })
      );
    });
  });

  describe('getRecentActivity', () => {
    it('should fetch recent activity for identifier', async () => {
      const mockActivity = [
        {
          identifier: 'U_user',
          action: 'SEAT_MAP_ACCESS',
          timestamp: new Date(),
        },
        {
          identifier: 'U_user',
          action: 'BLOCKED',
          timestamp: new Date(),
        },
      ];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockActivity),
      };

      mockFind.mockReturnValue(mockChain);

      const result = await auditLogger.getRecentActivity('U_user');

      expect(mockFind).toHaveBeenCalledWith({ identifier: 'U_user' });
      expect(mockChain.sort).toHaveBeenCalledWith({ timestamp: -1 });
      expect(mockChain.limit).toHaveBeenCalledWith(100);
      expect(result).toEqual(mockActivity);
    });

    it('should use custom limit when provided', async () => {
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };

      mockFind.mockReturnValue(mockChain);

      await auditLogger.getRecentActivity('U_user', 50);

      expect(mockChain.limit).toHaveBeenCalledWith(50);
    });

    it('should return empty array when no activity found', async () => {
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };

      mockFind.mockReturnValue(mockChain);

      const result = await auditLogger.getRecentActivity('U_newuser');

      expect(result).toEqual([]);
    });

    it('should sort by timestamp descending', async () => {
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };

      mockFind.mockReturnValue(mockChain);

      await auditLogger.getRecentActivity('U_user');

      expect(mockChain.sort).toHaveBeenCalledWith({ timestamp: -1 });
    });
  });

  describe('getBlockedIdentifiers', () => {
    it('should fetch list of blocked identifiers', async () => {
      const mockIdentifiers = ['U_attacker1', 'U_attacker2', 'IP_192.168.1.100'];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockResolvedValue(mockIdentifiers),
      };

      mockFind.mockReturnValue(mockChain);

      const result = await auditLogger.getBlockedIdentifiers();

      expect(mockFind).toHaveBeenCalledWith({ action: 'BLOCKED' });
      expect(mockChain.sort).toHaveBeenCalledWith({ timestamp: -1 });
      expect(mockChain.limit).toHaveBeenCalledWith(100);
      expect(mockChain.distinct).toHaveBeenCalledWith('identifier');
      expect(result).toEqual(mockIdentifiers);
    });

    it('should use custom limit when provided', async () => {
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockResolvedValue([]),
      };

      mockFind.mockReturnValue(mockChain);

      await auditLogger.getBlockedIdentifiers(200);

      expect(mockChain.limit).toHaveBeenCalledWith(200);
    });

    it('should return empty array when no blocked identifiers', async () => {
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockResolvedValue([]),
      };

      mockFind.mockReturnValue(mockChain);

      const result = await auditLogger.getBlockedIdentifiers();

      expect(result).toEqual([]);
    });

    it('should filter by BLOCKED action only', async () => {
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockResolvedValue([]),
      };

      mockFind.mockReturnValue(mockChain);

      await auditLogger.getBlockedIdentifiers();

      expect(mockFind).toHaveBeenCalledWith({ action: 'BLOCKED' });
    });

    it('should return unique identifiers', async () => {
      const mockIdentifiers = ['U_user1', 'U_user2'];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockResolvedValue(mockIdentifiers),
      };

      mockFind.mockReturnValue(mockChain);

      const result = await auditLogger.getBlockedIdentifiers();

      expect(result).toEqual(['U_user1', 'U_user2']);
      expect(result.length).toBe(2);
    });
  });
});
