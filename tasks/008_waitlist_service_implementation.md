# Task 008: Waitlist Service Implementation

## Objective
Implement the Waitlist Service with priority-based queue management, automatic seat assignment when seats become available, and integration with notification system.

## Priority
P1 (Should Have) - Enhances user experience for preferred seat selection

## Description
Build the Waitlist Service that manages seat waitlists with priority scoring (loyalty tier + booking time + special needs), automatically assigns seats when they become available, and coordinates with Seat Service and Notification Service.

## Prerequisites
- Task 001-003 completed (Seat Service running)
- Task 002 completed (Waitlist model created)
- Task 007 completed (Shared middleware)

## Technical Requirements

### 1. Directory Structure

```
src/waitlist-service/
├── controllers/
│   └── waitlist.controller.ts
├── services/
│   ├── waitlist-manager.service.ts
│   └── priority-calculator.service.ts
├── repositories/
│   └── waitlist.repository.ts
├── events/
│   ├── publishers/
│   │   └── waitlist.publisher.ts
│   └── subscribers/
│       └── seat.subscriber.ts           # Listen for seat available events
├── jobs/
│   └── waitlist-cleanup.job.ts         # Remove expired waitlist entries
├── clients/
│   ├── seat-service.client.ts
│   └── notification-service.client.ts
├── routes/
│   └── waitlist.routes.ts
├── app.ts
└── index.ts
```

### 2. Waitlist Repository

**src/waitlist-service/repositories/waitlist.repository.ts:**
```typescript
import { Waitlist, IWaitlist } from '../../shared/models/waitlist.model';
import { FilterQuery, ClientSession } from 'mongoose';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('waitlist-repository');

export class WaitlistRepository {
  async create(data: Partial<IWaitlist>): Promise<IWaitlist> {
    const waitlist = new Waitlist(data);
    await waitlist.save();
    logger.debug('Waitlist entry created', { waitlistId: waitlist.waitlistId });
    return waitlist;
  }

  async findOne(
    filter: FilterQuery<IWaitlist>,
    options?: { sort?: any; session?: ClientSession }
  ): Promise<IWaitlist | null> {
    let query = Waitlist.findOne(filter);

    if (options?.sort) query = query.sort(options.sort);
    if (options?.session) query = query.session(options.session);

    return query.exec();
  }

  async find(filter: FilterQuery<IWaitlist>): Promise<IWaitlist[]> {
    return Waitlist.find(filter);
  }

  async deleteOne(
    filter: FilterQuery<IWaitlist>,
    session?: ClientSession
  ): Promise<void> {
    await Waitlist.deleteOne(filter).session(session || null);
    logger.debug('Waitlist entry deleted', { filter });
  }

  async countDocuments(filter: FilterQuery<IWaitlist>): Promise<number> {
    return Waitlist.countDocuments(filter);
  }

  async deleteExpired(): Promise<number> {
    const result = await Waitlist.deleteMany({
      expiresAt: { $lte: new Date() },
    });
    return result.deletedCount;
  }
}
```

### 3. Priority Calculator Service

**src/waitlist-service/services/priority-calculator.service.ts:**
```typescript
import { LoyaltyTier } from '../../shared/types/common.types';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('priority-calculator');

export interface CalculatePriorityRequest {
  loyaltyTier: LoyaltyTier;
  bookingTimestamp: Date;
  hasSpecialNeeds?: boolean;
}

export class PriorityCalculatorService {
  calculate(req: CalculatePriorityRequest): number {
    let score = 0;

    // 1. Loyalty tier points (0-400)
    const tierScores: Record<LoyaltyTier, number> = {
      [LoyaltyTier.PLATINUM]: 400,
      [LoyaltyTier.GOLD]: 300,
      [LoyaltyTier.SILVER]: 200,
      [LoyaltyTier.REGULAR]: 100,
    };
    score += tierScores[req.loyaltyTier] || 100;

    // 2. Booking time points (0-400, earlier = higher)
    const daysAgo = Math.floor(
      (Date.now() - req.bookingTimestamp.getTime()) / (1000 * 60 * 60 * 24)
    );
    const bookingPoints = Math.min(400, daysAgo * 10);
    score += bookingPoints;

    // 3. Special needs bonus (200 points)
    if (req.hasSpecialNeeds) {
      score += 200;
    }

    logger.debug('Priority calculated', {
      loyaltyTier: req.loyaltyTier,
      daysAgo,
      hasSpecialNeeds: req.hasSpecialNeeds,
      totalScore: score,
    });

    return score;
  }

  estimateWaitTime(position: number): string {
    // Rough estimate based on position
    if (position === 1) return '5-10 minutes';
    if (position <= 3) return '15-30 minutes';
    if (position <= 5) return '30-60 minutes';
    return '1-2 hours';
  }
}
```

### 4. Waitlist Manager Service

**src/waitlist-service/services/waitlist-manager.service.ts:**
```typescript
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import { WaitlistRepository } from '../repositories/waitlist.repository';
import { PriorityCalculatorService } from './priority-calculator.service';
import { SeatServiceClient } from '../clients/seat-service.client';
import { NotificationServiceClient } from '../clients/notification-service.client';
import { WaitlistPublisher } from '../events/publishers/waitlist.publisher';
import { LoyaltyTier } from '../../shared/types/common.types';
import { createLogger } from '../../shared/utils/logger';
import { AppError } from '../../shared/errors/app-error';

const logger = createLogger('waitlist-manager');

export interface JoinWaitlistRequest {
  passengerId: string;
  flightId: string;
  seatId: string;
  loyaltyTier: LoyaltyTier;
  bookingTimestamp: Date;
  hasSpecialNeeds?: boolean;
}

export interface WaitlistResponse {
  waitlistId: string;
  position: number;
  estimatedWaitTime: string;
}

export class WaitlistManagerService {
  constructor(
    private waitlistRepository: WaitlistRepository,
    private priorityCalculator: PriorityCalculatorService,
    private seatClient: SeatServiceClient,
    private notificationClient: NotificationServiceClient,
    private eventPublisher: WaitlistPublisher
  ) {}

  async joinWaitlist(req: JoinWaitlistRequest): Promise<WaitlistResponse> {
    // 1. Check if passenger already on waitlist for this seat
    const existing = await this.waitlistRepository.findOne({
      passengerId: req.passengerId,
      flightId: req.flightId,
      seatId: req.seatId,
    });

    if (existing) {
      throw new AppError(
        409,
        'ALREADY_ON_WAITLIST',
        'You are already on the waitlist for this seat'
      );
    }

    // 2. Calculate priority score
    const priorityScore = this.priorityCalculator.calculate({
      loyaltyTier: req.loyaltyTier,
      bookingTimestamp: req.bookingTimestamp,
      hasSpecialNeeds: req.hasSpecialNeeds,
    });

    // 3. Add to waitlist
    const waitlistId = `wl_${uuid()}`;
    const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours before departure

    await this.waitlistRepository.create({
      waitlistId,
      passengerId: req.passengerId,
      flightId: req.flightId,
      seatId: req.seatId,
      priorityScore,
      loyaltyTier: req.loyaltyTier,
      expiresAt,
      createdAt: new Date(),
    });

    // 4. Get position in queue
    const position = await this.getWaitlistPosition(waitlistId);

    logger.info('Passenger joined waitlist', {
      waitlistId,
      passengerId: req.passengerId,
      seatId: req.seatId,
      position,
      priorityScore,
    });

    // 5. Publish event
    await this.eventPublisher.publish('waitlist.joined', {
      waitlistId,
      passengerId: req.passengerId,
      seatId: req.seatId,
      position,
    });

    return {
      waitlistId,
      position,
      estimatedWaitTime: this.priorityCalculator.estimateWaitTime(position),
    };
  }

  async leaveWaitlist(waitlistId: string, passengerId: string): Promise<void> {
    const waitlist = await this.waitlistRepository.findOne({ waitlistId });

    if (!waitlist) {
      throw new AppError(404, 'WAITLIST_NOT_FOUND', 'Waitlist entry not found');
    }

    if (waitlist.passengerId !== passengerId) {
      throw new AppError(403, 'FORBIDDEN', 'Passenger mismatch');
    }

    await this.waitlistRepository.deleteOne({ waitlistId });

    logger.info('Passenger left waitlist', { waitlistId, passengerId });

    await this.eventPublisher.publish('waitlist.left', {
      waitlistId,
      passengerId,
    });
  }

  private async getWaitlistPosition(waitlistId: string): Promise<number> {
    const entry = await this.waitlistRepository.findOne({ waitlistId });

    if (!entry) {
      throw new AppError(404, 'WAITLIST_NOT_FOUND', 'Waitlist entry not found');
    }

    // Count entries with higher priority for the same seat
    const higherPriorityCount = await this.waitlistRepository.countDocuments({
      seatId: entry.seatId,
      flightId: entry.flightId,
      priorityScore: { $gt: entry.priorityScore },
    });

    return higherPriorityCount + 1;
  }

  // Called when seat becomes available (from event)
  async processSeatAvailable(seatId: string, flightId: string): Promise<void> {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // 1. Find highest priority waitlist entry
        const waitlist = await this.waitlistRepository.findOne(
          { seatId, flightId },
          { sort: { priorityScore: -1 }, session }
        );

        if (!waitlist) {
          logger.info('No waitlist entries for seat', { seatId, flightId });
          return;
        }

        logger.info('Processing waitlist assignment', {
          waitlistId: waitlist.waitlistId,
          passengerId: waitlist.passengerId,
          seatId,
          priorityScore: waitlist.priorityScore,
        });

        // 2. Hold seat for waitlisted passenger (5-minute extended hold)
        try {
          const holdResult = await this.seatClient.holdSeat({
            seatId,
            flightId,
            passengerId: waitlist.passengerId,
            duration: 300, // 5 minutes for waitlist
          });

          // 3. Remove from waitlist
          await this.waitlistRepository.deleteOne(
            { waitlistId: waitlist.waitlistId },
            session
          );

          // 4. Notify passenger
          await this.notificationClient.send({
            passengerId: waitlist.passengerId,
            type: 'WAITLIST_SEAT_AVAILABLE',
            channels: ['push', 'email'],
            data: {
              seatId,
              flightId,
              expiresAt: holdResult.expiresAt,
            },
          });

          // 5. Publish event
          await this.eventPublisher.publish('waitlist.assigned', {
            waitlistId: waitlist.waitlistId,
            passengerId: waitlist.passengerId,
            seatId,
            flightId,
          });

          logger.info('Waitlist seat assigned', {
            waitlistId: waitlist.waitlistId,
            passengerId: waitlist.passengerId,
            seatId,
          });
        } catch (error: any) {
          logger.error('Failed to assign seat from waitlist', {
            error: error.message,
            waitlistId: waitlist.waitlistId,
          });
          // Seat hold failed - try next in queue
          await this.processSeatAvailable(seatId, flightId);
        }
      });
    } catch (error) {
      logger.error('Error processing waitlist', { error, seatId, flightId });
    } finally {
      await session.endSession();
    }
  }
}
```

### 5. Seat Event Subscriber

**src/waitlist-service/events/subscribers/seat.subscriber.ts:**
```typescript
import { EventBus, Event } from '../../../shared/events/event-bus';
import { WaitlistManagerService } from '../../services/waitlist-manager.service';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('seat-subscriber');

export class SeatSubscriber {
  constructor(
    private eventBus: EventBus,
    private waitlistManager: WaitlistManagerService
  ) {}

  start(): void {
    // Subscribe to seat release events
    this.eventBus.subscribe('seat.hold.expired', this.handleSeatHoldExpired.bind(this));
    this.eventBus.subscribe('seat.released', this.handleSeatReleased.bind(this));
    
    logger.info('Seat subscriber started');
  }

  private async handleSeatHoldExpired(event: Event): Promise<void> {
    logger.info('Seat hold expired event received', {
      eventId: event.eventId,
      seatId: event.data.seatId,
    });

    await this.waitlistManager.processSeatAvailable(
      event.data.seatId,
      event.data.flightId
    );
  }

  private async handleSeatReleased(event: Event): Promise<void> {
    logger.info('Seat released event received', {
      eventId: event.eventId,
      seatId: event.data.seatId,
    });

    await this.waitlistManager.processSeatAvailable(
      event.data.seatId,
      event.data.flightId
    );
  }
}
```

### 6. Waitlist Cleanup Job

**src/waitlist-service/jobs/waitlist-cleanup.job.ts:**
```typescript
import { WaitlistRepository } from '../repositories/waitlist.repository';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('waitlist-cleanup-job');

export class WaitlistCleanupJob {
  private intervalId?: NodeJS.Timeout;
  private readonly INTERVAL_MS = 60000; // 1 minute

  constructor(private waitlistRepository: WaitlistRepository) {}

  start(): void {
    logger.info('Starting waitlist cleanup job', { intervalMs: this.INTERVAL_MS });

    this.intervalId = setInterval(() => {
      this.cleanupExpiredEntries().catch((error) => {
        logger.error('Error in waitlist cleanup job', { error });
      });
    }, this.INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      logger.info('Waitlist cleanup job stopped');
    }
  }

  async cleanupExpiredEntries(): Promise<void> {
    const deletedCount = await this.waitlistRepository.deleteExpired();

    if (deletedCount > 0) {
      logger.info('Expired waitlist entries cleaned up', { count: deletedCount });
    }
  }
}
```

### 7. Controller

**src/waitlist-service/controllers/waitlist.controller.ts:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { WaitlistManagerService } from '../services/waitlist-manager.service';
import { LoyaltyTier } from '../../shared/types/common.types';

export class WaitlistController {
  constructor(private waitlistManager: WaitlistManagerService) {}

  joinWaitlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        passengerId,
        flightId,
        seatId,
        loyaltyTier,
        bookingTimestamp,
        hasSpecialNeeds,
      } = req.body;

      const result = await this.waitlistManager.joinWaitlist({
        passengerId,
        flightId,
        seatId,
        loyaltyTier: loyaltyTier as LoyaltyTier,
        bookingTimestamp: new Date(bookingTimestamp),
        hasSpecialNeeds,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  leaveWaitlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { waitlistId } = req.params;
      const { passengerId } = req.body;

      await this.waitlistManager.leaveWaitlist(waitlistId, passengerId);

      res.json({
        message: 'Removed from waitlist successfully',
        waitlistId,
      });
    } catch (error) {
      next(error);
    }
  };
}
```

### 8. Routes

**src/waitlist-service/routes/waitlist.routes.ts:**
```typescript
import { Router } from 'express';
import { WaitlistController } from '../controllers/waitlist.controller';

export const createWaitlistRoutes = (controller: WaitlistController): Router => {
  const router = Router();

  router.post('/waitlist/join', controller.joinWaitlist);
  router.delete('/waitlist/:waitlistId', controller.leaveWaitlist);

  return router;
};
```

### 9. Service Clients

**src/waitlist-service/clients/notification-service.client.ts:**
```typescript
import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('notification-service-client');

export interface SendNotificationRequest {
  passengerId: string;
  type: string;
  channels: string[];
  data: Record<string, any>;
}

export class NotificationServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async send(req: SendNotificationRequest): Promise<void> {
    try {
      await this.client.post('/api/v1/notifications/send', req);
      logger.info('Notification sent', { passengerId: req.passengerId, type: req.type });
    } catch (error: any) {
      logger.error('Failed to send notification', { error: error.message });
      // Don't throw - notification failure shouldn't block waitlist processing
    }
  }
}
```

### 10. Service Entry Point

**src/waitlist-service/index.ts:**
```typescript
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { connectDatabase } from '../shared/config/database';
import { createPubSubClients } from '../shared/config/redis';
import { EventBus } from '../shared/events/event-bus';
import { WaitlistRepository } from './repositories/waitlist.repository';
import { WaitlistManagerService } from './services/waitlist-manager.service';
import { PriorityCalculatorService } from './services/priority-calculator.service';
import { SeatServiceClient } from '../checkin-service/clients/seat-service.client';
import { NotificationServiceClient } from './clients/notification-service.client';
import { WaitlistController } from './controllers/waitlist.controller';
import { WaitlistPublisher } from './events/publishers/waitlist.publisher';
import { SeatSubscriber } from './events/subscribers/seat.subscriber';
import { WaitlistCleanupJob } from './jobs/waitlist-cleanup.job';
import { createWaitlistRoutes } from './routes/waitlist.routes';
import { errorHandler } from '../shared/middleware/error-handler';
import { requestLogger } from '../shared/middleware/request-logger';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('waitlist-service');
const PORT = process.env.WAITLIST_SERVICE_PORT || 3004;

async function bootstrap() {
  try {
    await connectDatabase();

    const { publisher, subscriber } = createPubSubClients();
    const eventBus = new EventBus(publisher, subscriber);

    // Initialize services
    const waitlistRepository = new WaitlistRepository();
    const priorityCalculator = new PriorityCalculatorService();
    const seatClient = new SeatServiceClient();
    const notificationClient = new NotificationServiceClient();
    const eventPublisher = new WaitlistPublisher(eventBus);

    const waitlistManager = new WaitlistManagerService(
      waitlistRepository,
      priorityCalculator,
      seatClient,
      notificationClient,
      eventPublisher
    );

    // Initialize controller
    const controller = new WaitlistController(waitlistManager);

    // Create Express app
    const app = express();
    app.use(express.json());
    app.use(requestLogger);
    app.use('/api/v1', createWaitlistRoutes(controller));
    app.get('/health', (req, res) => {
      res.json({ status: 'OK', service: 'waitlist-service' });
    });
    app.use(errorHandler);

    // Start event subscribers
    const seatSubscriber = new SeatSubscriber(eventBus, waitlistManager);
    seatSubscriber.start();

    // Start cleanup job
    const cleanupJob = new WaitlistCleanupJob(waitlistRepository);
    cleanupJob.start();

    // Start server
    app.listen(PORT, () => {
      logger.info(`Waitlist Service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Waitlist Service', { error });
    process.exit(1);
  }
}

bootstrap();
```

## Implementation Steps

1. Create waitlist-service directory structure
2. Implement priority calculator with scoring algorithm
3. Implement waitlist repository
4. Implement waitlist manager service
5. Create seat event subscriber
6. Implement cleanup job for expired entries
7. Create controller and routes
8. Set up service clients
9. Create Express app and start service

## Testing Strategy

### Manual Testing After Completion:

**Test 1: Join Waitlist**
```bash
curl -X POST http://localhost:3004/api/v1/waitlist/join \
  -H "Content-Type: application/json" \
  -d '{
    "passengerId": "P55555",
    "flightId": "SK123",
    "seatId": "12A",
    "loyaltyTier": "GOLD",
    "bookingTimestamp": "2026-02-10T10:00:00Z",
    "hasSpecialNeeds": false
  }'
```
Expected: Returns waitlistId, position, and estimated wait time

**Test 2: Priority Order Test**
Add multiple passengers with different loyalty tiers:
```bash
# Passenger 1 - REGULAR
curl -X POST http://localhost:3004/api/v1/waitlist/join \
  -H "Content-Type: application/json" \
  -d '{
    "passengerId": "P11111",
    "flightId": "SK123",
    "seatId": "15C",
    "loyaltyTier": "REGULAR",
    "bookingTimestamp": "2026-02-20T10:00:00Z"
  }'

# Passenger 2 - PLATINUM
curl -X POST http://localhost:3004/api/v1/waitlist/join \
  -H "Content-Type: application/json" \
  -d '{
    "passengerId": "P22222",
    "flightId": "SK123",
    "seatId": "15C",
    "loyaltyTier": "PLATINUM",
    "bookingTimestamp": "2026-02-15T10:00:00Z"
  }'
```
Expected: PLATINUM passenger should get position 1

**Test 3: Automatic Assignment (End-to-End)**
```bash
# 1. Hold a seat
curl -X POST http://localhost:3001/api/v1/seats/hold \
  -H "Content-Type: application/json" \
  -d '{
    "flightId": "SK123",
    "seatId": "20A",
    "passengerId": "P99999"
  }'

# 2. Join waitlist for that seat
curl -X POST http://localhost:3004/api/v1/waitlist/join \
  -H "Content-Type: application/json" \
  -d '{
    "passengerId": "P88888",
    "flightId": "SK123",
    "seatId": "20A",
    "loyaltyTier": "GOLD",
    "bookingTimestamp": "2026-02-10T10:00:00Z"
  }'

# 3. Wait 120 seconds for hold to expire
# Background job in Seat Service will release seat
# Waitlist Service should automatically assign to P88888

# 4. Check MongoDB to verify assignment
mongosh mongodb://admin:password@localhost:27017/skyhigh --authSource admin
> db.seats.findOne({ seatId: "20A", flightId: "SK123" })
# Should show: heldByPassengerId: "P88888"
```

**Test 4: Leave Waitlist**
```bash
curl -X DELETE http://localhost:3004/api/v1/waitlist/{waitlistId} \
  -H "Content-Type: application/json" \
  -d '{
    "passengerId": "P55555"
  }'
```
Expected: 200 OK with success message

### Verification Checklist:
- [ ] Waitlist Service starts on port 3004
- [ ] Join waitlist creates entry in MongoDB
- [ ] Priority score calculated correctly
- [ ] Position in queue returned accurately
- [ ] Duplicate waitlist entries prevented
- [ ] Seat event subscriber receives seat.hold.expired events
- [ ] Automatic seat assignment works
- [ ] Notification sent to passenger (if notification service ready)
- [ ] Cleanup job removes expired entries
- [ ] Leave waitlist removes entry

## Expected Outputs
- Working Waitlist Service on port 3004
- Priority-based queue management
- Automatic seat assignment on availability
- Event-driven architecture integration
- Background job for cleanup
- Ready for notification integration

## Estimated Complexity
**High** - Complex priority logic and event-driven seat assignment.

## Dependencies
- Task 001-003 (Seat Service with events)
- Task 002 (Waitlist model)
- Task 007 (Shared middleware)

## Next Tasks
- Task 009: Notification Service Implementation
- Task 010: API Gateway with Authentication
