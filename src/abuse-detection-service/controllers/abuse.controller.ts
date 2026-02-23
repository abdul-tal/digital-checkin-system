import { Request, Response, NextFunction } from 'express';
import { PatternDetectorService } from '../services/pattern-detector.service';
import { BlockingService } from '../services/blocking.service';
import { AuditLoggerService } from '../services/audit-logger.service';

export class AbuseController {
  constructor(
    private patternDetector: PatternDetectorService,
    private blockingService: BlockingService,
    private auditLogger: AuditLoggerService
  ) {}

  checkAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, ip, action } = req.body;
      const identifier = userId || ip;

      const isBlocked = await this.blockingService.isBlocked(identifier);
      if (isBlocked) {
        res.json({
          blocked: true,
          reason: 'Previously blocked for suspicious activity',
        });
        return;
      }

      let requiresCaptcha = false;
      let blocked = false;

      if (action === 'SEAT_MAP_ACCESS') {
        blocked = await this.patternDetector.checkRapidSeatMapAccess({ userId, ip, action });
      } else if (action === 'HOLD_SEAT') {
        requiresCaptcha = await this.patternDetector.checkHoldSpam(userId!);
      }

      res.json({
        blocked,
        requiresCaptcha,
        identifier,
      });
    } catch (error) {
      next(error);
    }
  };

  unblock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { identifier } = req.body;
      await this.blockingService.unblock(identifier);
      res.json({ message: 'Unblocked successfully', identifier });
    } catch (error) {
      next(error);
    }
  };

  getActivity = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { identifier } = req.params;
      const activity = await this.auditLogger.getRecentActivity(identifier);
      res.json({ identifier, activity });
    } catch (error) {
      next(error);
    }
  };

  getBlocked = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const blocked = await this.auditLogger.getBlockedIdentifiers();
      res.json({ blocked, count: blocked.length });
    } catch (error) {
      next(error);
    }
  };
}
