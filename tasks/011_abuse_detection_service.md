# Task 011: Abuse Detection Service Implementation

## Objective
Implement an Abuse Detection Service that identifies and blocks suspicious access patterns, bot activity, and excessive seat hoarding using sliding window algorithms.

## Priority
P1 (Should Have) - Protects system from abuse and bot attacks

## Description
Build an abuse detection service that monitors access patterns, detects rapid seat map access, identifies seat hoarding behavior, and enforces blocking rules with Redis-based tracking.

## Prerequisites
- Task 001 completed (Project setup with Redis)
- Task 007 completed (Shared middleware)
- Task 002 completed (AccessLog model)

## Technical Requirements

### 1. Directory Structure

```
src/abuse-detection-service/
├── controllers/
│   └── abuse.controller.ts
├── services/
│   ├── pattern-detector.service.ts      # Detect suspicious patterns
│   ├── blocking.service.ts              # Block/unblock users
│   └── audit-logger.service.ts          # Log to database
├── repositories/
│   └── access-log.repository.ts
├── middleware/
│   └── abuse-check.middleware.ts        # Middleware for gateway
├── routes/
│   └── abuse.routes.ts
├── app.ts
└── index.ts
```

### 2. Pattern Detector Service

**src/abuse-detection-service/services/pattern-detector.service.ts:**
```typescript
import { Redis } from 'ioredis';
import { BlockingService } from './blocking.service';
import { AuditLoggerService } from './audit-logger.service';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('pattern-detector');

export interface CheckAccessRequest {
  userId?: string;
  ip: string;
  action: 'SEAT_MAP_ACCESS' | 'HOLD_SEAT';
}

export class PatternDetectorService {
  // Thresholds from PRD
  private readonly RAPID_SEAT_MAP_THRESHOLD = 50;
  private readonly SEAT_MAP_WINDOW_MS = 2000; // 2 seconds
  
  private readonly HOLD_SPAM_THRESHOLD = 10;
  private readonly HOLD_SPAM_WINDOW_MS = 300000; // 5 minutes

  constructor(
    private redis: Redis,
    private blockingService: BlockingService,
    private auditLogger: AuditLoggerService
  ) {}

  async checkRapidSeatMapAccess(req: CheckAccessRequest): Promise<boolean> {
    const identifier = req.userId || req.ip;
    const key = `seatmap_access:${identifier}`;

    // Increment counter
    const count = await this.redis.incr(key);

    // Set expiry on first access
    if (count === 1) {
      await this.redis.pexpire(key, this.SEAT_MAP_WINDOW_MS);
    }

    logger.debug('Seat map access tracked', { identifier, count });

    // Check threshold
    if (count > this.RAPID_SEAT_MAP_THRESHOLD) {
      await this.blockingService.block({
        identifier,
        reason: 'RAPID_SEAT_MAP_ACCESS',
        duration: 300, // 5 minutes
        metadata: { count, threshold: this.RAPID_SEAT_MAP_THRESHOLD },
      });

      await this.auditLogger.log({
        identifier,
        action: 'BLOCKED',
        reason: 'Rapid seat map access detected',
        metadata: { count, threshold: this.RAPID_SEAT_MAP_THRESHOLD },
      });

      logger.warn('Rapid seat map access detected - BLOCKED', {
        identifier,
        count,
        threshold: this.RAPID_SEAT_MAP_THRESHOLD,
      });

      return true; // Blocked
    }

    return false; // Not blocked
  }

  async checkHoldSpam(userId: string): Promise<boolean> {
    const key = `hold_spam:${userId}`;

    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.pexpire(key, this.HOLD_SPAM_WINDOW_MS);
    }

    logger.debug('Hold attempt tracked', { userId, count });

    if (count > this.HOLD_SPAM_THRESHOLD) {
      await this.blockingService.requireCaptcha(userId);

      await this.auditLogger.log({
        identifier: userId,
        action: 'CAPTCHA_REQUIRED',
        reason: 'Rapid hold/release detected',
        metadata: { count, threshold: this.HOLD_SPAM_THRESHOLD },
      });

      logger.warn('Rapid hold/release detected - CAPTCHA required', {
        userId,
        count,
      });

      return true; // Requires CAPTCHA
    }

    return false;
  }

  async isBlocked(identifier: string): Promise<boolean> {
    return this.blockingService.isBlocked(identifier);
  }

  async requiresCaptcha(userId: string): Promise<boolean> {
    return this.blockingService.requiresCaptcha(userId);
  }
}
```

### 3. Blocking Service

**src/abuse-detection-service/services/blocking.service.ts:**
```typescript
import { Redis } from 'ioredis';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('blocking-service');

export interface BlockRequest {
  identifier: string;
  reason: string;
  duration: number; // seconds
  metadata?: Record<string, any>;
}

export class BlockingService {
  constructor(private redis: Redis) {}

  async block(req: BlockRequest): Promise<void> {
    const key = `blocked:${req.identifier}`;

    await this.redis.setex(
      key,
      req.duration,
      JSON.stringify({
        reason: req.reason,
        blockedAt: new Date().toISOString(),
        metadata: req.metadata,
      })
    );

    logger.info('Identifier blocked', {
      identifier: req.identifier,
      reason: req.reason,
      duration: req.duration,
    });
  }

  async isBlocked(identifier: string): Promise<boolean> {
    const key = `blocked:${identifier}`;
    const blocked = await this.redis.get(key);
    return !!blocked;
  }

  async unblock(identifier: string): Promise<void> {
    const key = `blocked:${identifier}`;
    await this.redis.del(key);
    logger.info('Identifier unblocked', { identifier });
  }

  async requireCaptcha(userId: string): Promise<void> {
    const key = `captcha_required:${userId}`;
    await this.redis.setex(key, 3600, 'true'); // 1 hour
    logger.info('CAPTCHA required for user', { userId });
  }

  async requiresCaptcha(userId: string): Promise<boolean> {
    const key = `captcha_required:${userId}`;
    const required = await this.redis.get(key);
    return !!required;
  }

  async clearCaptcha(userId: string): Promise<void> {
    const key = `captcha_required:${userId}`;
    await this.redis.del(key);
    logger.info('CAPTCHA requirement cleared', { userId });
  }
}
```

### 4. Audit Logger Service

**src/abuse-detection-service/services/audit-logger.service.ts:**
```typescript
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
      // Don't throw - audit logging failure shouldn't block operations
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
```

### 5. Abuse Check Middleware (for API Gateway)

**src/abuse-detection-service/middleware/abuse-check.middleware.ts:**
```typescript
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

      // Check if blocked
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
        return res.status(403).json({
          error: {
            code: 'ACCESS_BLOCKED',
            message: 'Your access has been temporarily blocked due to suspicious activity',
            reason: response.data.reason,
            unblockAt: response.data.unblockAt,
          },
        });
      }

      if (response.data.requiresCaptcha) {
        return res.status(403).json({
          error: {
            code: 'CAPTCHA_REQUIRED',
            message: 'Please complete CAPTCHA verification',
          },
        });
      }

      next();
    } catch (error: any) {
      // If abuse service is down, allow request (fail open)
      logger.error('Abuse check failed - allowing request', { error: error.message });
      next();
    }
  };
};
```

### 6. Controller

**src/abuse-detection-service/controllers/abuse.controller.ts:**
```typescript
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

  checkAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, ip, action } = req.body;
      const identifier = userId || ip;

      // Check if already blocked
      const isBlocked = await this.blockingService.isBlocked(identifier);
      if (isBlocked) {
        return res.json({
          blocked: true,
          reason: 'Previously blocked for suspicious activity',
        });
      }

      // Check patterns based on action
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

  getBlocked = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const blocked = await this.auditLogger.getBlockedIdentifiers();
      res.json({ blocked, count: blocked.length });
    } catch (error) {
      next(error);
    }
  };
}
```

### 7. Routes

**src/abuse-detection-service/routes/abuse.routes.ts:**
```typescript
import { Router } from 'express';
import { AbuseController } from '../controllers/abuse.controller';

export const createAbuseRoutes = (controller: AbuseController): Router => {
  const router = Router();

  router.post('/abuse/check', controller.checkAccess);
  router.post('/abuse/unblock', controller.unblock);
  router.get('/abuse/activity/:identifier', controller.getActivity);
  router.get('/abuse/blocked', controller.getBlocked);

  return router;
};
```

### 8. Service Entry Point

**src/abuse-detection-service/index.ts:**
```typescript
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { connectDatabase } from '../shared/config/database';
import { createRedisClient } from '../shared/config/redis';
import { PatternDetectorService } from './services/pattern-detector.service';
import { BlockingService } from './services/blocking.service';
import { AuditLoggerService } from './services/audit-logger.service';
import { AbuseController } from './controllers/abuse.controller';
import { createAbuseRoutes } from './routes/abuse.routes';
import { errorHandler } from '../shared/middleware/error-handler';
import { requestLogger } from '../shared/middleware/request-logger';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('abuse-detection-service');
const PORT = process.env.ABUSE_DETECTION_SERVICE_PORT || 3007;

async function bootstrap() {
  try {
    await connectDatabase();

    const redis = createRedisClient();

    // Initialize services
    const blockingService = new BlockingService(redis);
    const auditLogger = new AuditLoggerService();
    const patternDetector = new PatternDetectorService(
      redis,
      blockingService,
      auditLogger
    );

    // Initialize controller
    const controller = new AbuseController(
      patternDetector,
      blockingService,
      auditLogger
    );

    // Create Express app
    const app = express();
    app.use(express.json());
    app.use(requestLogger);
    app.use('/api/v1', createAbuseRoutes(controller));
    app.get('/health', (req, res) => {
      res.json({ status: 'OK', service: 'abuse-detection-service' });
    });
    app.use(errorHandler);

    // Start server
    app.listen(PORT, () => {
      logger.info(`Abuse Detection Service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Abuse Detection Service', { error });
    process.exit(1);
  }
}

bootstrap();
```

## Implementation Steps

1. Create abuse-detection-service directory
2. Implement pattern detector with sliding window algorithms
3. Implement blocking service with Redis
4. Create audit logger for database persistence
5. Implement controllers and routes
6. Create middleware for API Gateway integration
7. Test with rapid requests

## Testing Strategy

### Manual Testing After Completion:

**Test 1: Rapid Seat Map Access**
```bash
# Send 60 rapid requests (exceeds 50 threshold)
for i in {1..60}; do
  curl -X POST http://localhost:3007/api/v1/abuse/check \
    -H "Content-Type: application/json" \
    -d '{
      "userId": "U_attacker",
      "ip": "192.168.1.100",
      "action": "SEAT_MAP_ACCESS"
    }' &
done
wait
```
Expected: After 50 requests, user gets blocked

**Test 2: Hold Spam Detection**
```bash
# Send 15 hold requests (exceeds 10 threshold)
for i in {1..15}; do
  curl -X POST http://localhost:3007/api/v1/abuse/check \
    -H "Content-Type: application/json" \
    -d '{
      "userId": "U_spammer",
      "ip": "192.168.1.101",
      "action": "HOLD_SEAT"
    }' -s | jq '.requiresCaptcha'
done
```
Expected: After 10 requests, CAPTCHA required

**Test 3: Check Blocked Status**
```bash
curl http://localhost:3007/api/v1/abuse/blocked
```
Expected: List of blocked identifiers

**Test 4: View Activity**
```bash
curl http://localhost:3007/api/v1/abuse/activity/U_attacker
```
Expected: Recent activity log for that user

**Test 5: Unblock User**
```bash
curl -X POST http://localhost:3007/api/v1/abuse/unblock \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "U_attacker"
  }'
```
Expected: Success message

### Integration with API Gateway:

Update API Gateway to use abuse check middleware:
```typescript
// In api-gateway/app.ts
import { createAbuseCheckMiddleware } from '../abuse-detection-service/middleware/abuse-check.middleware';

const abuseCheck = createAbuseCheckMiddleware();

// Apply to sensitive routes
router.get('/flights/:flightId/seatmap', abuseCheck, authenticate, ...);
router.post('/seats/hold', abuseCheck, authenticate, ...);
```

### Verification Checklist:
- [ ] Abuse Detection Service starts on port 3007
- [ ] Rapid access detection works (>50 req/2s)
- [ ] Hold spam detection works (>10 holds/5min)
- [ ] Blocking stores data in Redis with TTL
- [ ] Blocked users cannot make requests
- [ ] CAPTCHA requirement flag set correctly
- [ ] Audit logs written to MongoDB
- [ ] Unblock API works
- [ ] Activity log API returns recent actions
- [ ] Middleware integrates with API Gateway

## Expected Outputs
- Working Abuse Detection Service on port 3007
- Pattern detection with sliding windows
- Blocking mechanism with Redis
- Audit logging to MongoDB
- Admin APIs for unblocking and viewing activity
- Middleware ready for API Gateway integration

## Estimated Complexity
**Medium** - Sliding window algorithms and Redis-based tracking.

## Dependencies
- Task 001 (Project setup with Redis)
- Task 002 (AccessLog model)
- Task 007 (Shared middleware)

## Next Tasks
- Task 012: Monitoring and Observability Setup
- Task 013: Testing Suite Implementation
