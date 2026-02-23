import { Request, Response, NextFunction } from 'express';
import { AbuseController } from '../../../src/abuse-detection-service/controllers/abuse.controller';
import { PatternDetectorService } from '../../../src/abuse-detection-service/services/pattern-detector.service';
import { BlockingService } from '../../../src/abuse-detection-service/services/blocking.service';
import { AuditLoggerService } from '../../../src/abuse-detection-service/services/audit-logger.service';

describe('AbuseController', () => {
  let controller: AbuseController;
  let mockPatternDetector: jest.Mocked<PatternDetectorService>;
  let mockBlockingService: jest.Mocked<BlockingService>;
  let mockAuditLogger: jest.Mocked<AuditLoggerService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockPatternDetector = {
      checkRapidSeatMapAccess: jest.fn(),
      checkHoldSpam: jest.fn(),
      isBlocked: jest.fn(),
      requiresCaptcha: jest.fn(),
    } as any;

    mockBlockingService = {
      block: jest.fn(),
      isBlocked: jest.fn(),
      unblock: jest.fn(),
      requireCaptcha: jest.fn(),
      requiresCaptcha: jest.fn(),
      clearCaptcha: jest.fn(),
    } as any;

    mockAuditLogger = {
      log: jest.fn(),
      getRecentActivity: jest.fn(),
      getBlockedIdentifiers: jest.fn(),
    } as any;

    mockRequest = {
      body: {},
      params: {},
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    controller = new AbuseController(
      mockPatternDetector,
      mockBlockingService,
      mockAuditLogger
    );
  });

  describe('checkAccess', () => {
    it('should return blocked status for already blocked identifier', async () => {
      mockRequest.body = {
        userId: 'U_blocked',
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      };

      mockBlockingService.isBlocked.mockResolvedValue(true);

      await controller.checkAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockBlockingService.isBlocked).toHaveBeenCalledWith('U_blocked');
      expect(mockResponse.json).toHaveBeenCalledWith({
        blocked: true,
        reason: 'Previously blocked for suspicious activity',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should check rapid seat map access for SEAT_MAP_ACCESS action', async () => {
      mockRequest.body = {
        userId: 'U_user',
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      };

      mockBlockingService.isBlocked.mockResolvedValue(false);
      mockPatternDetector.checkRapidSeatMapAccess.mockResolvedValue(false);

      await controller.checkAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPatternDetector.checkRapidSeatMapAccess).toHaveBeenCalledWith({
        userId: 'U_user',
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        blocked: false,
        requiresCaptcha: false,
        identifier: 'U_user',
      });
    });

    it('should check hold spam for HOLD_SEAT action', async () => {
      mockRequest.body = {
        userId: 'U_spammer',
        ip: '192.168.1.100',
        action: 'HOLD_SEAT',
      };

      mockBlockingService.isBlocked.mockResolvedValue(false);
      mockPatternDetector.checkHoldSpam.mockResolvedValue(true);

      await controller.checkAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPatternDetector.checkHoldSpam).toHaveBeenCalledWith('U_spammer');
      expect(mockResponse.json).toHaveBeenCalledWith({
        blocked: false,
        requiresCaptcha: true,
        identifier: 'U_spammer',
      });
    });

    it('should use IP as identifier when userId is not provided', async () => {
      mockRequest.body = {
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      };

      mockBlockingService.isBlocked.mockResolvedValue(false);
      mockPatternDetector.checkRapidSeatMapAccess.mockResolvedValue(false);

      await controller.checkAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockBlockingService.isBlocked).toHaveBeenCalledWith('192.168.1.100');
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: '192.168.1.100',
        })
      );
    });

    it('should return blocked true when rapid access detected', async () => {
      mockRequest.body = {
        userId: 'U_attacker',
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      };

      mockBlockingService.isBlocked.mockResolvedValue(false);
      mockPatternDetector.checkRapidSeatMapAccess.mockResolvedValue(true);

      await controller.checkAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        blocked: true,
        requiresCaptcha: false,
        identifier: 'U_attacker',
      });
    });

    it('should handle errors by calling next', async () => {
      mockRequest.body = {
        userId: 'U_user',
        ip: '192.168.1.100',
        action: 'SEAT_MAP_ACCESS',
      };

      const error = new Error('Service error');
      mockBlockingService.isBlocked.mockRejectedValue(error);

      await controller.checkAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should handle no action specified', async () => {
      mockRequest.body = {
        userId: 'U_user',
        ip: '192.168.1.100',
      };

      mockBlockingService.isBlocked.mockResolvedValue(false);

      await controller.checkAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPatternDetector.checkRapidSeatMapAccess).not.toHaveBeenCalled();
      expect(mockPatternDetector.checkHoldSpam).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        blocked: false,
        requiresCaptcha: false,
        identifier: 'U_user',
      });
    });
  });

  describe('unblock', () => {
    it('should unblock identifier', async () => {
      mockRequest.body = { identifier: 'U_blocked' };

      await controller.unblock(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockBlockingService.unblock).toHaveBeenCalledWith('U_blocked');
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Unblocked successfully',
        identifier: 'U_blocked',
      });
    });

    it('should handle unblock errors', async () => {
      mockRequest.body = { identifier: 'U_user' };

      const error = new Error('Unblock failed');
      mockBlockingService.unblock.mockRejectedValue(error);

      await controller.unblock(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('getActivity', () => {
    it('should fetch activity for identifier', async () => {
      mockRequest.params = { identifier: 'U_user' };

      const mockActivity = [
        {
          identifier: 'U_user',
          action: 'SEAT_MAP_ACCESS',
          timestamp: new Date(),
        },
      ];

      mockAuditLogger.getRecentActivity.mockResolvedValue(mockActivity);

      await controller.getActivity(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuditLogger.getRecentActivity).toHaveBeenCalledWith('U_user');
      expect(mockResponse.json).toHaveBeenCalledWith({
        identifier: 'U_user',
        activity: mockActivity,
      });
    });

    it('should handle empty activity', async () => {
      mockRequest.params = { identifier: 'U_newuser' };
      mockAuditLogger.getRecentActivity.mockResolvedValue([]);

      await controller.getActivity(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        identifier: 'U_newuser',
        activity: [],
      });
    });

    it('should handle errors', async () => {
      mockRequest.params = { identifier: 'U_user' };

      const error = new Error('Database error');
      mockAuditLogger.getRecentActivity.mockRejectedValue(error);

      await controller.getActivity(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getBlocked', () => {
    it('should fetch list of blocked identifiers', async () => {
      const mockBlocked = ['U_attacker1', 'U_attacker2', 'IP_192.168.1.100'];
      mockAuditLogger.getBlockedIdentifiers.mockResolvedValue(mockBlocked);

      await controller.getBlocked(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuditLogger.getBlockedIdentifiers).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        blocked: mockBlocked,
        count: 3,
      });
    });

    it('should handle empty blocked list', async () => {
      mockAuditLogger.getBlockedIdentifiers.mockResolvedValue([]);

      await controller.getBlocked(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        blocked: [],
        count: 0,
      });
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockAuditLogger.getBlockedIdentifiers.mockRejectedValue(error);

      await controller.getBlocked(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
