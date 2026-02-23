# Task 003: Seat Service Implementation

## Objective
Implement the Seat Service with conflict-free seat hold/release logic, seat map API, and background job for hold expiration. This is the core service that prevents seat assignment conflicts.

## Priority
P0 (Must Have) - Critical for preventing seat conflicts

## Description
Build the Seat Service with atomic seat reservation using MongoDB transactions, implement seat map caching with Redis, create background job for hold expiration, and expose REST APIs for seat operations.

## Prerequisites
- Task 001 completed (Project setup)
- Task 002 completed (Database schemas and models)
- MongoDB and Redis running

## Technical Requirements

### 1. Directory Structure

```
src/seat-service/
├── controllers/
│   ├── seat.controller.ts              # HTTP request handlers
│   └── seatmap.controller.ts           # Seat map handlers
├── services/
│   ├── seat-management.service.ts      # Core business logic
│   ├── seat-hold.service.ts            # Hold/release logic
│   └── seat-cache.service.ts           # Redis caching
├── repositories/
│   └── seat.repository.ts              # MongoDB data access
├── jobs/
│   └── hold-expiration.job.ts          # Background job (runs every 10s)
├── events/
│   ├── publishers/
│   │   └── seat.publisher.ts           # Publish seat events
│   └── subscribers/
│       └── seat.subscriber.ts          # Subscribe to seat events
├── validators/
│   └── seat.validator.ts               # Request validation
├── routes/
│   └── seat.routes.ts                  # Route definitions
├── app.ts                              # Express app setup
└── index.ts                            # Entry point
```

### 2. Core Service Implementation

#### Seat Repository (Data Access Layer)
**src/seat-service/repositories/seat.repository.ts:**
```typescript
import { Seat, ISeat } from '../../shared/models/seat.model';
import { FilterQuery, UpdateQuery, ClientSession } from 'mongoose';

export class SeatRepository {
  async findOne(
    filter: FilterQuery<ISeat>,
    session?: ClientSession
  ): Promise<ISeat | null> {
    return Seat.findOne(filter).session(session || null);
  }

  async find(
    filter: FilterQuery<ISeat>,
    options?: { limit?: number; sort?: any; session?: ClientSession }
  ): Promise<ISeat[]> {
    let query = Seat.find(filter);

    if (options?.sort) query = query.sort(options.sort);
    if (options?.limit) query = query.limit(options.limit);
    if (options?.session) query = query.session(options.session);

    return query.exec();
  }

  async findOneAndUpdate(
    filter: FilterQuery<ISeat>,
    update: UpdateQuery<ISeat>,
    options: { returnDocument: 'after'; session: ClientSession }
  ): Promise<ISeat | null> {
    return Seat.findOneAndUpdate(filter, update, {
      new: true,
      session: options.session,
    });
  }

  async updateMany(
    filter: FilterQuery<ISeat>,
    update: UpdateQuery<ISeat>,
    session?: ClientSession
  ): Promise<number> {
    const result = await Seat.updateMany(filter, update).session(session || null);
    return result.modifiedCount;
  }

  async countDocuments(filter: FilterQuery<ISeat>): Promise<number> {
    return Seat.countDocuments(filter);
  }
}
```

#### Seat Hold Service (Core Business Logic)
**src/seat-service/services/seat-hold.service.ts:**
```typescript
import mongoose from 'mongoose';
import { SeatRepository } from '../repositories/seat.repository';
import { SeatCacheService } from './seat-cache.service';
import { SeatPublisher } from '../events/publishers/seat.publisher';
import { SeatUnavailableError } from '../../shared/errors/app-error';
import { SeatState } from '../../shared/types/common.types';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('seat-hold-service');

export interface HoldSeatRequest {
  flightId: string;
  seatId: string;
  passengerId: string;
  duration?: number; // Optional custom duration (for waitlist)
}

export interface HoldSeatResponse {
  holdId: string;
  seatId: string;
  expiresAt: Date;
  remainingSeconds: number;
}

export class SeatHoldService {
  constructor(
    private seatRepository: SeatRepository,
    private cacheService: SeatCacheService,
    private eventPublisher: SeatPublisher
  ) {}

  async holdSeat(req: HoldSeatRequest): Promise<HoldSeatResponse> {
    const session = await mongoose.startSession();
    const duration = req.duration || parseInt(process.env.SEAT_HOLD_DURATION_SECONDS || '120');
    const expiresAt = new Date(Date.now() + duration * 1000);

    try {
      const result = await session.withTransaction(async () => {
        // 1. Attempt atomic seat hold (prevents race conditions)
        const seat = await this.seatRepository.findOneAndUpdate(
          {
            seatId: req.seatId,
            flightId: req.flightId,
            state: SeatState.AVAILABLE,
          },
          {
            $set: {
              state: SeatState.HELD,
              heldByPassengerId: req.passengerId,
              holdExpiresAt: expiresAt,
              updatedAt: new Date(),
            },
          },
          {
            returnDocument: 'after',
            session,
          }
        );

        // Seat not available - find alternatives
        if (!seat) {
          const alternatives = await this.findAlternativeSeats(
            req.flightId,
            req.seatId,
            session
          );
          throw new SeatUnavailableError(alternatives);
        }

        logger.info('Seat held successfully', {
          seatId: req.seatId,
          passengerId: req.passengerId,
          expiresAt,
        });

        return seat;
      });

      // 2. Invalidate cache (outside transaction)
      await this.cacheService.invalidateSeatMap(req.flightId);

      // 3. Publish event (outside transaction)
      await this.eventPublisher.publish('seat.held', {
        seatId: req.seatId,
        flightId: req.flightId,
        passengerId: req.passengerId,
        expiresAt,
      });

      return {
        holdId: result._id.toString(),
        seatId: result.seatId,
        expiresAt: result.holdExpiresAt!,
        remainingSeconds: duration,
      };
    } finally {
      await session.endSession();
    }
  }

  async releaseSeat(seatId: string, flightId: string): Promise<void> {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const seat = await this.seatRepository.findOneAndUpdate(
          { seatId, flightId, state: { $in: [SeatState.HELD, SeatState.CONFIRMED] } },
          {
            $set: {
              state: SeatState.AVAILABLE,
              heldByPassengerId: null,
              holdExpiresAt: null,
              confirmedByPassengerId: null,
              updatedAt: new Date(),
            },
          },
          { returnDocument: 'after', session }
        );

        if (!seat) {
          throw new Error('Seat not found or already released');
        }

        logger.info('Seat released', { seatId, flightId });
      });

      await this.cacheService.invalidateSeatMap(flightId);
      await this.eventPublisher.publish('seat.released', { seatId, flightId });
    } finally {
      await session.endSession();
    }
  }

  async confirmSeat(
    seatId: string,
    flightId: string,
    passengerId: string
  ): Promise<void> {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const seat = await this.seatRepository.findOneAndUpdate(
          {
            seatId,
            flightId,
            state: SeatState.HELD,
            heldByPassengerId: passengerId,
          },
          {
            $set: {
              state: SeatState.CONFIRMED,
              confirmedByPassengerId: passengerId,
              holdExpiresAt: null,
              updatedAt: new Date(),
            },
          },
          { returnDocument: 'after', session }
        );

        if (!seat) {
          throw new Error('Seat hold not found or expired');
        }

        logger.info('Seat confirmed', { seatId, flightId, passengerId });
      });

      await this.cacheService.invalidateSeatMap(flightId);
      await this.eventPublisher.publish('seat.confirmed', {
        seatId,
        flightId,
        passengerId,
      });
    } finally {
      await session.endSession();
    }
  }

  private async findAlternativeSeats(
    flightId: string,
    originalSeatId: string,
    session: ClientSession
  ): Promise<string[]> {
    const [rowStr, column] = [
      originalSeatId.slice(0, -1),
      originalSeatId.slice(-1),
    ];
    const row = parseInt(rowStr);

    // Determine seat type preference
    const seatType =
      column === 'A' || column === 'F' ? 'WINDOW' :
      column === 'C' || column === 'D' ? 'AISLE' :
      'MIDDLE';

    // Find 3 similar available seats (same type, nearby row)
    const alternatives = await this.seatRepository.find(
      {
        flightId,
        state: SeatState.AVAILABLE,
        seatType,
        rowNumber: { $gte: row - 2, $lte: row + 2 },
      },
      { limit: 3, sort: { rowNumber: 1 }, session }
    );

    return alternatives.map((s) => s.seatId);
  }
}
```

#### Seat Map Service (Read Operations)
**src/seat-service/services/seat-management.service.ts:**
```typescript
import { SeatRepository } from '../repositories/seat.repository';
import { SeatCacheService } from './seat-cache.service';
import { SeatState, SeatType } from '../../shared/types/common.types';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('seat-management-service');

export interface SeatMapResponse {
  flightId: string;
  aircraft: string;
  totalSeats: number;
  availableSeats: number;
  seats: SeatInfo[];
  cachedAt?: string;
}

export interface SeatInfo {
  seatId: string;
  row: number;
  column: string;
  state: 'AVAILABLE' | 'UNAVAILABLE';
  type: SeatType;
  price: number;
}

export class SeatManagementService {
  constructor(
    private seatRepository: SeatRepository,
    private cacheService: SeatCacheService
  ) {}

  async getSeatMap(flightId: string): Promise<SeatMapResponse> {
    // 1. Check cache first
    const cached = await this.cacheService.getSeatMap(flightId);
    if (cached) {
      logger.info('Seat map served from cache', { flightId });
      return cached;
    }

    // 2. Fetch from database
    const seats = await this.seatRepository.find({ flightId });

    if (seats.length === 0) {
      throw new Error('Flight not found or no seats available');
    }

    // 3. Transform to response format (hide held/confirmed details from others)
    const seatMap: SeatMapResponse = {
      flightId,
      aircraft: 'Boeing 737',
      totalSeats: seats.length,
      availableSeats: seats.filter((s) => s.state === SeatState.AVAILABLE).length,
      seats: seats.map((seat) => ({
        seatId: seat.seatId,
        row: seat.rowNumber,
        column: seat.columnLetter,
        state: seat.state === SeatState.AVAILABLE ? 'AVAILABLE' : 'UNAVAILABLE',
        type: seat.seatType,
        price: seat.price,
      })),
    };

    // 4. Cache the result
    await this.cacheService.setSeatMap(flightId, seatMap);

    logger.info('Seat map fetched from database', { flightId, totalSeats: seats.length });

    return seatMap;
  }

  async getSeatDetails(seatId: string, flightId: string, passengerId?: string) {
    const seat = await this.seatRepository.findOne({ seatId, flightId });

    if (!seat) {
      throw new Error('Seat not found');
    }

    // If seat is held/confirmed by this passenger, show full details
    if (
      passengerId &&
      (seat.heldByPassengerId === passengerId ||
        seat.confirmedByPassengerId === passengerId)
    ) {
      return seat;
    }

    // Otherwise, hide sensitive info
    return {
      seatId: seat.seatId,
      flightId: seat.flightId,
      row: seat.rowNumber,
      column: seat.columnLetter,
      type: seat.seatType,
      state: seat.state === SeatState.AVAILABLE ? 'AVAILABLE' : 'UNAVAILABLE',
      price: seat.price,
    };
  }
}
```

#### Seat Cache Service
**src/seat-service/services/seat-cache.service.ts:**
```typescript
import { Redis } from 'ioredis';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('seat-cache-service');

export class SeatCacheService {
  private readonly CACHE_TTL = parseInt(
    process.env.CACHE_SEATMAP_TTL_SECONDS || '5'
  );
  private readonly CACHE_PREFIX = 'seatmap';

  constructor(private redis: Redis) {}

  async getSeatMap(flightId: string): Promise<any | null> {
    const key = `${this.CACHE_PREFIX}:${flightId}`;
    const cached = await this.redis.get(key);

    if (cached) {
      logger.debug('Cache hit', { flightId });
      return JSON.parse(cached);
    }

    logger.debug('Cache miss', { flightId });
    return null;
  }

  async setSeatMap(flightId: string, seatMap: any): Promise<void> {
    const key = `${this.CACHE_PREFIX}:${flightId}`;
    await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(seatMap));
    logger.debug('Cache set', { flightId, ttl: this.CACHE_TTL });
  }

  async invalidateSeatMap(flightId: string): Promise<void> {
    const key = `${this.CACHE_PREFIX}:${flightId}`;
    await this.redis.del(key);
    logger.debug('Cache invalidated', { flightId });
  }
}
```

### 3. Background Job: Hold Expiration

**src/seat-service/jobs/hold-expiration.job.ts:**
```typescript
import mongoose from 'mongoose';
import { SeatRepository } from '../repositories/seat.repository';
import { SeatCacheService } from '../services/seat-cache.service';
import { SeatPublisher } from '../events/publishers/seat.publisher';
import { SeatState } from '../../shared/types/common.types';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('hold-expiration-job');

export class HoldExpirationJob {
  private intervalId?: NodeJS.Timeout;
  private readonly INTERVAL_MS = 10000; // 10 seconds

  constructor(
    private seatRepository: SeatRepository,
    private cacheService: SeatCacheService,
    private eventPublisher: SeatPublisher
  ) {}

  start(): void {
    logger.info('Starting hold expiration job', { intervalMs: this.INTERVAL_MS });

    this.intervalId = setInterval(() => {
      this.processExpiredHolds().catch((error) => {
        logger.error('Error in hold expiration job', { error });
      });
    }, this.INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      logger.info('Hold expiration job stopped');
    }
  }

  async processExpiredHolds(): Promise<void> {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Find all expired holds
        const expiredSeats = await this.seatRepository.find({
          state: SeatState.HELD,
          holdExpiresAt: { $lte: new Date() },
        });

        if (expiredSeats.length === 0) {
          return;
        }

        logger.info(`Processing ${expiredSeats.length} expired holds`);

        // Release all expired holds
        for (const seat of expiredSeats) {
          await this.seatRepository.findOneAndUpdate(
            { _id: seat._id },
            {
              $set: {
                state: SeatState.AVAILABLE,
                heldByPassengerId: null,
                holdExpiresAt: null,
                updatedAt: new Date(),
              },
            },
            { returnDocument: 'after', session }
          );

          // Invalidate cache
          await this.cacheService.invalidateSeatMap(seat.flightId);

          // Publish event for waitlist processing
          await this.eventPublisher.publish('seat.hold.expired', {
            seatId: seat.seatId,
            flightId: seat.flightId,
            previousHolder: seat.heldByPassengerId,
          });

          logger.info('Seat hold expired and released', {
            seatId: seat.seatId,
            flightId: seat.flightId,
            previousHolder: seat.heldByPassengerId,
          });
        }
      });
    } catch (error) {
      logger.error('Error processing expired holds', { error });
    } finally {
      await session.endSession();
    }
  }
}
```

### 4. Controllers (HTTP Handlers)

**src/seat-service/controllers/seat.controller.ts:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { SeatHoldService } from '../services/seat-hold.service';
import { SeatManagementService } from '../services/seat-management.service';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('seat-controller');

export class SeatController {
  constructor(
    private seatHoldService: SeatHoldService,
    private seatManagementService: SeatManagementService
  ) {}

  getSeatMap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { flightId } = req.params;
      const seatMap = await this.seatManagementService.getSeatMap(flightId);

      res.json(seatMap);
    } catch (error) {
      next(error);
    }
  };

  holdSeat = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { flightId, seatId, passengerId } = req.body;

      const result = await this.seatHoldService.holdSeat({
        flightId,
        seatId,
        passengerId,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  releaseSeat = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { seatId, flightId } = req.body;

      await this.seatHoldService.releaseSeat(seatId, flightId);

      res.json({
        message: 'Seat released successfully',
        seatId,
        state: 'AVAILABLE',
      });
    } catch (error) {
      next(error);
    }
  };

  confirmSeat = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { seatId, flightId, passengerId } = req.body;

      await this.seatHoldService.confirmSeat(seatId, flightId, passengerId);

      res.json({
        message: 'Seat confirmed successfully',
        seatId,
        state: 'CONFIRMED',
      });
    } catch (error) {
      next(error);
    }
  };
}
```

### 5. Routes

**src/seat-service/routes/seat.routes.ts:**
```typescript
import { Router } from 'express';
import { SeatController } from '../controllers/seat.controller';
import { validateHoldRequest, validateReleaseRequest } from '../validators/seat.validator';

export const createSeatRoutes = (controller: SeatController): Router => {
  const router = Router();

  // Get seat map
  router.get('/flights/:flightId/seatmap', controller.getSeatMap);

  // Hold seat
  router.post('/seats/hold', validateHoldRequest, controller.holdSeat);

  // Release seat
  router.post('/seats/release', validateReleaseRequest, controller.releaseSeat);

  // Confirm seat (internal API)
  router.post('/seats/confirm', controller.confirmSeat);

  return router;
};
```

### 6. Request Validation

**src/seat-service/validators/seat.validator.ts:**
```typescript
import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../shared/errors/app-error';

const holdSeatSchema = Joi.object({
  flightId: Joi.string()
    .pattern(/^[A-Z]{2}[0-9]{1,4}$/)
    .required()
    .messages({ 'string.pattern.base': 'Invalid flight ID format (e.g., SK123)' }),
  seatId: Joi.string()
    .pattern(/^[0-9]{1,2}[A-F]$/)
    .required()
    .messages({ 'string.pattern.base': 'Invalid seat ID format (e.g., 12A)' }),
  passengerId: Joi.string().min(5).max(50).required(),
});

export const validateHoldRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error } = holdSeatSchema.validate(req.body);

  if (error) {
    return next(new ValidationError(error.details[0].message));
  }

  next();
};

const releaseSeatSchema = Joi.object({
  seatId: Joi.string().pattern(/^[0-9]{1,2}[A-F]$/).required(),
  flightId: Joi.string().pattern(/^[A-Z]{2}[0-9]{1,4}$/).required(),
});

export const validateReleaseRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error } = releaseSeatSchema.validate(req.body);

  if (error) {
    return next(new ValidationError(error.details[0].message));
  }

  next();
};
```

### 7. Express App Setup

**src/seat-service/app.ts:**
```typescript
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createSeatRoutes } from './routes/seat.routes';
import { SeatController } from './controllers/seat.controller';
import { errorHandler } from '../../shared/middleware/error-handler';
import { requestLogger } from '../../shared/middleware/request-logger';

export const createApp = (controller: SeatController): Express => {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json());
  app.use(requestLogger);

  // Routes
  app.use('/api/v1', createSeatRoutes(controller));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'seat-service', timestamp: new Date() });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
};
```

### 8. Service Entry Point

**src/seat-service/index.ts:**
```typescript
import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { connectDatabase } from '../shared/config/database';
import { createRedisClient, createPubSubClients } from '../shared/config/redis';
import { SeatRepository } from './repositories/seat.repository';
import { SeatHoldService } from './services/seat-hold.service';
import { SeatManagementService } from './services/seat-management.service';
import { SeatCacheService } from './services/seat-cache.service';
import { SeatController } from './controllers/seat.controller';
import { SeatPublisher } from './events/publishers/seat.publisher';
import { HoldExpirationJob } from './jobs/hold-expiration.job';
import { EventBus } from '../shared/events/event-bus';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('seat-service');
const PORT = process.env.SEAT_SERVICE_PORT || 3001;

async function bootstrap() {
  try {
    // Connect to database
    await connectDatabase();

    // Create Redis clients
    const cacheRedis = createRedisClient();
    const { publisher, subscriber } = createPubSubClients();
    const eventBus = new EventBus(publisher, subscriber);

    // Initialize services
    const seatRepository = new SeatRepository();
    const cacheService = new SeatCacheService(cacheRedis);
    const eventPublisher = new SeatPublisher(eventBus);
    const seatHoldService = new SeatHoldService(
      seatRepository,
      cacheService,
      eventPublisher
    );
    const seatManagementService = new SeatManagementService(
      seatRepository,
      cacheService
    );

    // Initialize controller
    const controller = new SeatController(seatHoldService, seatManagementService);

    // Create Express app
    const app = createApp(controller);

    // Start background job
    const holdExpirationJob = new HoldExpirationJob(
      seatRepository,
      cacheService,
      eventPublisher
    );
    holdExpirationJob.start();

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Seat Service listening on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      holdExpirationJob.stop();
      server.close();
      await eventBus.close();
      await cacheRedis.quit();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start Seat Service', { error });
    process.exit(1);
  }
}

bootstrap();
```

### 9. Event Publisher

**src/seat-service/events/publishers/seat.publisher.ts:**
```typescript
import { EventBus } from '../../../shared/events/event-bus';

export class SeatPublisher {
  constructor(private eventBus: EventBus) {}

  async publish(eventType: string, data: Record<string, any>): Promise<void> {
    await this.eventBus.publish(eventType, data);
  }
}
```

## Implementation Steps

1. Create all service directories and files
2. Implement seat repository with MongoDB transactions
3. Implement seat hold service with atomic operations
4. Implement seat management service for seat map queries
5. Implement cache service with Redis
6. Create controllers and routes
7. Set up Express app with middleware
8. Implement background job for hold expiration
9. Create event publisher for seat events
10. Add error handling middleware
11. Test all endpoints manually

## Testing Strategy

### Manual API Testing After Completion:

**Test 1: Get Seat Map**
```bash
curl http://localhost:3001/api/v1/flights/SK123/seatmap
```
Expected: 200 OK with 180 seats

**Test 2: Hold a Seat**
```bash
curl -X POST http://localhost:3001/api/v1/seats/hold \
  -H "Content-Type: application/json" \
  -d '{
    "flightId": "SK123",
    "seatId": "12A",
    "passengerId": "P12345"
  }'
```
Expected: 200 OK with holdId and expiresAt

**Test 3: Hold Same Seat Again (Conflict Test)**
```bash
curl -X POST http://localhost:3001/api/v1/seats/hold \
  -H "Content-Type: application/json" \
  -d '{
    "flightId": "SK123",
    "seatId": "12A",
    "passengerId": "P99999"
  }'
```
Expected: 409 Conflict with alternative seat suggestions

**Test 4: Wait for Hold Expiration (2 minutes)**
Wait 120 seconds, then check seat map again:
```bash
curl http://localhost:3001/api/v1/flights/SK123/seatmap | jq '.seats[] | select(.seatId == "12A")'
```
Expected: Seat 12A should be AVAILABLE again

**Test 5: Concurrent Hold Test (Race Condition)**
Use a tool like Apache Bench to send 10 concurrent requests:
```bash
# Create request file
echo '{
  "flightId": "SK123",
  "seatId": "15C",
  "passengerId": "P{{INDEX}}"
}' > hold-request.json

# Use a simple bash script to test concurrency
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/v1/seats/hold \
    -H "Content-Type: application/json" \
    -d "{\"flightId\":\"SK123\",\"seatId\":\"15C\",\"passengerId\":\"P$i\"}" &
done
wait
```
Expected: Exactly 1 success (200), 9 failures (409)

### Verification Checklist:
- [ ] Seat Service starts without errors on port 3001
- [ ] GET /flights/SK123/seatmap returns 180 seats
- [ ] POST /seats/hold successfully reserves an available seat
- [ ] Second hold request for same seat returns 409 with alternatives
- [ ] Hold expires after 120 seconds automatically
- [ ] Background job logs show periodic execution
- [ ] Redis cache is populated and invalidated correctly
- [ ] MongoDB shows correct state transitions (AVAILABLE → HELD → AVAILABLE)
- [ ] Concurrent holds for same seat produce exactly 1 success
- [ ] Events published to Redis pub/sub

## Expected Outputs
- Working Seat Service on port 3001
- All CRUD operations for seats functional
- Atomic seat hold preventing race conditions
- Background job releasing expired holds every 10 seconds
- Redis caching with 5-second TTL
- Event publishing for inter-service communication
- API responses following standard format

## Estimated Complexity
**High** - Critical service with complex transaction logic and concurrency handling.

## Dependencies
- Task 001 (Project setup)
- Task 002 (Database schemas)

## Next Tasks
- Task 004: Check-In Service Implementation
- After this task, you have a TESTABLE seat management system!
