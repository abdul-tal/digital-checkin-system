import { AccessLog } from '../../shared/models/access-log.model';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('audit-logger');

export interface LogAccessRequest {
  identifier: string;
  action: 'SEAT_MAP_ACCESS' | 'HOLD_SEAT' | 'BLOCKED' | 'CAPTCHA_REQUIRED';
  reason?: string;
  metadata?: Record<string, any>;
}

export class AuditLoggerService {
  async log(req: LogAccessRequest): Promise<void> {
    try {
      await AccessLog.create({
        identifier: req.identifier,
        action: req.action,
        reason: req.reason,
        metadata: req.metadata || {},
        timestamp: new Date(),
      });

      logger.debug('Access logged', {
        identifier: req.identifier,
        action: req.action,
      });
    } catch (error) {
      logger.error('Failed to log access', { error });
    }
  }

  async getRecentActivity(
    identifier: string,
    limit = 100
  ): Promise<any[]> {
    return AccessLog.find({ identifier })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  async getBlockedIdentifiers(limit = 100): Promise<string[]> {
    const logs = await AccessLog.find({ action: 'BLOCKED' })
      .sort({ timestamp: -1 })
      .limit(limit)
      .distinct('identifier');

    return logs;
  }
}
