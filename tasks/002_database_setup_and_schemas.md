# Task 002: Database Setup and Schemas

## Objective
Create MongoDB collections with schema validation, indexes, and seed data for testing the seat management system.

## Priority
P0 (Must Have) - Required for storing and managing seat/check-in data

## Description
Set up MongoDB database schemas for seats, check-ins, waitlist, payments, and access logs. Configure indexes for performance and implement data seeding scripts for testing.

## Prerequisites
- Task 001 completed (Project setup with MongoDB running)
- MongoDB connection established
- Mongoose ODM installed

## Technical Requirements

### 1. MongoDB Collections

#### Collection: seats
```typescript
// src/shared/models/seat.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ISeat extends Document {
  seatId: string;
  flightId: string;
  rowNumber: number;
  columnLetter: string;
  seatType: 'WINDOW' | 'MIDDLE' | 'AISLE';
  state: 'AVAILABLE' | 'HELD' | 'CONFIRMED' | 'CANCELLED';
  heldByPassengerId?: string;
  holdExpiresAt?: Date;
  confirmedByPassengerId?: string;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}

const SeatSchema = new Schema<ISeat>({
  seatId: { type: String, required: true, maxlength: 10 },
  flightId: { type: String, required: true, maxlength: 20 },
  rowNumber: { type: Number, required: true, min: 1 },
  columnLetter: { type: String, required: true, maxlength: 1 },
  seatType: {
    type: String,
    required: true,
    enum: ['WINDOW', 'MIDDLE', 'AISLE'],
  },
  state: {
    type: String,
    required: true,
    enum: ['AVAILABLE', 'HELD', 'CONFIRMED', 'CANCELLED'],
    default: 'AVAILABLE',
  },
  heldByPassengerId: { type: String, maxlength: 50 },
  holdExpiresAt: { type: Date },
  confirmedByPassengerId: { type: String, maxlength: 50 },
  price: { type: Number, required: true, min: 0 },
}, {
  timestamps: true,
});

// Indexes
SeatSchema.index({ flightId: 1, state: 1 });
SeatSchema.index({ seatId: 1, flightId: 1 }, { unique: true });
SeatSchema.index({ holdExpiresAt: 1 }, { 
  partialFilterExpression: { state: 'HELD' } 
});
SeatSchema.index({ flightId: 1, seatType: 1, state: 1 });

export const Seat = mongoose.model<ISeat>('Seat', SeatSchema);
```

#### Collection: checkins
```typescript
// src/shared/models/checkin.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ICheckIn extends Document {
  checkInId: string;
  userId: string;
  passengerId: string;
  flightId: string;
  seatId?: string;
  state: 'NOT_STARTED' | 'IN_PROGRESS' | 'AWAITING_PAYMENT' | 'COMPLETED' | 'CANCELLED';
  baggage?: {
    count: number;
    weights: number[];
    fee: number;
  };
  paymentUrl?: string;
  boardingPass?: {
    qrCode: string;
    gate: string;
    boardingTime: Date;
  };
  createdAt: Date;
  completedAt?: Date;
}

const CheckInSchema = new Schema<ICheckIn>({
  checkInId: { type: String, required: true, unique: true, maxlength: 50 },
  userId: { type: String, required: true, maxlength: 50 },
  passengerId: { type: String, required: true, maxlength: 50 },
  flightId: { type: String, required: true, maxlength: 20 },
  seatId: { type: String, maxlength: 10 },
  state: {
    type: String,
    required: true,
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'AWAITING_PAYMENT', 'COMPLETED', 'CANCELLED'],
    default: 'NOT_STARTED',
  },
  baggage: {
    count: { type: Number, min: 0 },
    weights: [{ type: Number, min: 0 }],
    fee: { type: Number, min: 0 },
  },
  paymentUrl: { type: String },
  boardingPass: {
    qrCode: { type: String },
    gate: { type: String },
    boardingTime: { type: Date },
  },
  completedAt: { type: Date },
}, {
  timestamps: true,
});

// Indexes
CheckInSchema.index({ checkInId: 1 }, { unique: true });
CheckInSchema.index({ passengerId: 1, flightId: 1 });
CheckInSchema.index({ userId: 1, createdAt: -1 });
CheckInSchema.index({ state: 1, createdAt: -1 });

export const CheckIn = mongoose.model<ICheckIn>('CheckIn', CheckInSchema);
```

#### Collection: waitlist
```typescript
// src/shared/models/waitlist.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IWaitlist extends Document {
  waitlistId: string;
  passengerId: string;
  flightId: string;
  seatId: string;
  priorityScore: number;
  loyaltyTier: 'PLATINUM' | 'GOLD' | 'SILVER' | 'REGULAR';
  createdAt: Date;
  expiresAt: Date;
}

const WaitlistSchema = new Schema<IWaitlist>({
  waitlistId: { type: String, required: true, unique: true, maxlength: 50 },
  passengerId: { type: String, required: true, maxlength: 50 },
  flightId: { type: String, required: true, maxlength: 20 },
  seatId: { type: String, required: true, maxlength: 10 },
  priorityScore: { type: Number, required: true, min: 0 },
  loyaltyTier: {
    type: String,
    required: true,
    enum: ['PLATINUM', 'GOLD', 'SILVER', 'REGULAR'],
  },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
});

// Indexes
WaitlistSchema.index({ seatId: 1, priorityScore: -1 });
WaitlistSchema.index({ waitlistId: 1 }, { unique: true });
WaitlistSchema.index({ expiresAt: 1 });
WaitlistSchema.index({ passengerId: 1, flightId: 1, seatId: 1 }, { unique: true });

export const Waitlist = mongoose.model<IWaitlist>('Waitlist', WaitlistSchema);
```

#### Collection: payments
```typescript
// src/shared/models/payment.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  paymentId: string;
  checkInId: string;
  passengerId: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  transactionId?: string;
  createdAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

const PaymentSchema = new Schema<IPayment>({
  paymentId: { type: String, required: true, unique: true, maxlength: 50 },
  checkInId: { type: String, required: true, maxlength: 50 },
  passengerId: { type: String, required: true, maxlength: 50 },
  amount: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'EXPIRED'],
    default: 'PENDING',
  },
  transactionId: { type: String, maxlength: 100 },
  completedAt: { type: Date },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
});

// Indexes
PaymentSchema.index({ paymentId: 1 }, { unique: true });
PaymentSchema.index({ checkInId: 1 });
PaymentSchema.index({ status: 1, expiresAt: 1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
```

#### Collection: access_logs
```typescript
// src/shared/models/access-log.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IAccessLog extends Document {
  identifier: string;
  action: 'SEAT_MAP_ACCESS' | 'HOLD_SEAT' | 'BLOCKED' | 'CAPTCHA_REQUIRED';
  reason?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

const AccessLogSchema = new Schema<IAccessLog>({
  identifier: { type: String, required: true, maxlength: 100 },
  action: {
    type: String,
    required: true,
    enum: ['SEAT_MAP_ACCESS', 'HOLD_SEAT', 'BLOCKED', 'CAPTCHA_REQUIRED'],
  },
  reason: { type: String, maxlength: 200 },
  metadata: { type: Schema.Types.Mixed },
  timestamp: { type: Date, required: true, default: Date.now },
});

// TTL index - auto-delete after 30 days
AccessLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });
AccessLogSchema.index({ identifier: 1, timestamp: -1 });

export const AccessLog = mongoose.model<IAccessLog>('AccessLog', AccessLogSchema);
```

### 2. Database Connection

**src/shared/config/database.ts:**
```typescript
import mongoose from 'mongoose';
import { createLogger } from '../utils/logger';

const logger = createLogger('database');

export const connectDatabase = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/skyhigh';

  try {
    await mongoose.connect(uri, {
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '100'),
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '10'),
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

  } catch (error) {
    logger.error('MongoDB connection failed', { error });
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
};
```

### 3. Data Seeding Script

**scripts/seed-data.ts:**
```typescript
import { connectDatabase, closeDatabase } from '../src/shared/config/database';
import { Seat } from '../src/shared/models/seat.model';

const seedSeats = async () => {
  console.log('Seeding seats for flight SK123...');

  const seats = [];
  const rows = 30;
  const columns = ['A', 'B', 'C', 'D', 'E', 'F'];

  for (let row = 1; row <= rows; row++) {
    for (const col of columns) {
      const seatType = 
        col === 'A' || col === 'F' ? 'WINDOW' :
        col === 'C' || col === 'D' ? 'AISLE' :
        'MIDDLE';

      // Premium seats (rows 1-5) cost $50, standard seats cost $25
      const price = row <= 5 ? 50 : 25;

      seats.push({
        seatId: `${row}${col}`,
        flightId: 'SK123',
        rowNumber: row,
        columnLetter: col,
        seatType,
        state: 'AVAILABLE',
        price,
      });
    }
  }

  // Clear existing seats for SK123
  await Seat.deleteMany({ flightId: 'SK123' });

  // Insert new seats
  await Seat.insertMany(seats);

  console.log(`✅ Seeded ${seats.length} seats for flight SK123`);
};

const main = async () => {
  try {
    await connectDatabase();
    await seedSeats();
    console.log('✅ Database seeding completed');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
};

main();
```

### 4. MongoDB Initialization Script

**scripts/init-mongodb.sh:**
```bash
#!/bin/bash

echo "Initializing MongoDB replica set..."

docker exec skyhigh-mongodb mongosh --eval "
try {
  rs.status();
  print('Replica set already initialized');
} catch (e) {
  rs.initiate({
    _id: 'rs0',
    members: [{ _id: 0, host: 'localhost:27017' }]
  });
  print('Replica set initialized successfully');
}
"

echo "Creating database and indexes..."

docker exec skyhigh-mongodb mongosh --eval "
use skyhigh;
db.createCollection('seats');
db.createCollection('checkins');
db.createCollection('waitlist');
db.createCollection('payments');
db.createCollection('access_logs');
print('Collections created successfully');
"
```

### 5. Redis Connection

**src/shared/config/redis.ts:**
```typescript
import Redis from 'ioredis';
import { createLogger } from '../utils/logger';

const logger = createLogger('redis');

export const createRedisClient = (): Redis => {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    enableOfflineQueue: false,
    maxRetriesPerRequest: 3,
  });

  redis.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  redis.on('error', (err) => {
    logger.error('Redis connection error', { error: err });
  });

  redis.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return redis;
};

export const createPubSubClients = () => {
  return {
    publisher: createRedisClient(),
    subscriber: createRedisClient(),
  };
};
```

### 6. Event Bus Infrastructure

**src/shared/events/event-bus.ts:**
```typescript
import { Redis } from 'ioredis';
import { v4 as uuid } from 'uuid';
import { createLogger } from '../utils/logger';

const logger = createLogger('event-bus');

export interface Event {
  eventId: string;
  eventType: string;
  timestamp: Date;
  source: string;
  data: Record<string, any>;
  correlationId?: string;
}

export class EventBus {
  constructor(
    private publisher: Redis,
    private subscriber: Redis
  ) {}

  async publish(eventType: string, data: Record<string, any>): Promise<void> {
    const event: Event = {
      eventId: uuid(),
      eventType,
      timestamp: new Date(),
      source: process.env.SERVICE_NAME || 'unknown',
      data,
      correlationId: data.correlationId,
    };

    await this.publisher.publish(eventType, JSON.stringify(event));
    logger.info('Event published', { eventType, eventId: event.eventId });
  }

  subscribe(
    eventType: string,
    handler: (event: Event) => Promise<void>
  ): void {
    this.subscriber.subscribe(eventType, (err) => {
      if (err) {
        logger.error('Subscribe error', { eventType, error: err });
      } else {
        logger.info('Subscribed to event', { eventType });
      }
    });

    this.subscriber.on('message', async (channel, message) => {
      if (channel === eventType) {
        try {
          const event: Event = JSON.parse(message);
          logger.info('Event received', { eventType, eventId: event.eventId });
          await handler(event);
        } catch (error) {
          logger.error('Event handler error', {
            eventType,
            error,
            message,
          });
        }
      }
    });
  }

  async close(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
    logger.info('Event bus closed');
  }
}
```

## Implementation Steps

### Step 1: Create Model Files
Create all Mongoose models in `src/shared/models/` with schema validation.

### Step 2: Set Up Database Connection
Create database.ts with connection pooling configuration.

### Step 3: Initialize MongoDB Replica Set
Run initialization script to enable transactions support.

### Step 4: Create Indexes
Ensure all indexes are created programmatically on application startup.

### Step 5: Create Seeding Script
Generate test data for 1 flight with 180 seats (30 rows × 6 columns).

### Step 6: Set Up Redis Clients
Create Redis connection utility for cache and pub/sub.

### Step 7: Implement Event Bus
Create event bus for inter-service communication.

## Testing Strategy

### Manual Testing After Completion:
```bash
# 1. Start services
docker-compose up -d

# 2. Initialize MongoDB replica set
chmod +x scripts/init-mongodb.sh
./scripts/init-mongodb.sh

# 3. Run seed script
npm run seed

# 4. Verify data in MongoDB
mongosh mongodb://admin:password@localhost:27017/skyhigh --authSource admin
> use skyhigh
> db.seats.countDocuments({ flightId: 'SK123' })
> db.seats.find({ flightId: 'SK123', rowNumber: 12 }).pretty()

# 5. Verify Redis connection
redis-cli ping
> PONG
```

### Verification Checklist:
- [ ] MongoDB replica set initialized
- [ ] All collections created with schema validation
- [ ] Indexes created successfully
- [ ] Seed data: 180 seats for flight SK123
- [ ] Redis connection working
- [ ] Event bus publishes and subscribes successfully
- [ ] No database connection errors in logs

## Expected Outputs
- 5 Mongoose models with validation
- Database connection utility
- Redis connection utility
- Event bus implementation
- Seeding script with 180 seats
- MongoDB initialization script
- All indexes created and verified

## Estimated Complexity
**Medium** - Requires understanding of MongoDB schema design, indexing, and Mongoose ODM.

## Dependencies
- Task 001 (Project setup must be complete)

## Next Tasks
- Task 003: Seat Service Implementation (uses these models)
