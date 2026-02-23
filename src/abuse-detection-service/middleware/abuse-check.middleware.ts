import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('abuse-check-middleware');

export const createAbuseCheckMiddleware = () => {
  const abuseServiceUrl = process.env.ABUSE_DETECTION_SERVICE_URL || 'http://localhost:3007';

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;
      const ip = req.ip;

      const response = await axios.post(
        `${abuseServiceUrl}/api/v1/abuse/check`,
        {
          userId,
          ip,
          action: req.path.includes('seatmap') ? 'SEAT_MAP_ACCESS' : 'HOLD_SEAT',
        },
        { timeout: 1000 }
      );

      if (response.data.blocked) {
        res.status(403).json({
          error: {
            code: 'ACCESS_BLOCKED',
            message: 'Your access has been temporarily blocked due to suspicious activity',
            reason: response.data.reason,
            unblockAt: response.data.unblockAt,
          },
        });
        return;
      }

      if (response.data.requiresCaptcha) {
        res.status(403).json({
          error: {
            code: 'CAPTCHA_REQUIRED',
            message: 'Please complete CAPTCHA verification',
          },
        });
        return;
      }

      next();
    } catch (error: any) {
      logger.error('Abuse check failed - allowing request', { error: error.message });
      next();
    }
  };
};
