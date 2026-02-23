# Task 013: Testing Suite Implementation

## Objective
Implement comprehensive testing suite including unit tests, integration tests, and end-to-end tests with high code coverage.

## Priority
P0 (Must Have) - Ensures code quality and prevents regressions

## Description
Create unit tests for business logic, integration tests for API endpoints, and end-to-end tests for complete user flows using Jest, Supertest, and test containers.

## Prerequisites
- Task 001-010 completed (All services implemented)

## Technical Requirements

### 1. Test Configuration

**jest.config.js:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.spec.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
  },
};
```

### 2. Test Setup

**tests/setup.ts:**
```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Redis from 'ioredis-mock';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Export mock Redis for tests
export const createMockRedis = () => new Redis();
```

### 3. Unit Tests

#### Seat Hold Service Unit Tests
**tests/unit/seat-hold.service.spec.ts:**
```typescript
import { SeatHoldService } from '../../src/seat-service/services/seat-hold.service';
import { SeatRepository } from '../../src/seat-service/repositories/seat.repository';
import { SeatCacheService } from '../../src/seat-service/services/seat-cache.service';
import { SeatPublisher } from '../../src/seat-service/events/publishers/seat.publisher';
import { SeatUnavailableError } from '../../src/shared/errors/app-error';

describe('SeatHoldService', () => {
  let service: SeatHoldService;
  let seatRepository: jest.Mocked<SeatRepository>;
  let cacheService: jest.Mocked<SeatCacheService>;
  let eventPublisher: jest.Mocked<SeatPublisher>;

  beforeEach(() => {
    seatRepository = {
      findOneAndUpdate: jest.fn(),
      find: jest.fn(),
    } as any;

    cacheService = {
      invalidateSeatMap: jest.fn(),
    } as any;

    eventPublisher = {
      publish: jest.fn(),
    } as any;

    service = new SeatHoldService(seatRepository, cacheService, eventPublisher);
  });

  describe('holdSeat', () => {
    it('should successfully hold an available seat', async () => {
      const request = {
        flightId: 'SK123',
        seatId: '12A',
        passengerId: 'P12345',
      };

      const mockSeat = {
        _id: 'seat_id',
        seatId: '12A',
        flightId: 'SK123',
        state: 'HELD',
        heldByPassengerId: 'P12345',
        holdExpiresAt: new Date(Date.now() + 120000),
      };

      seatRepository.findOneAndUpdate.mockResolvedValue(mockSeat as any);

      const result = await service.holdSeat(request);

      expect(result.seatId).toBe('12A');
      expect(result.remainingSeconds).toBe(120);
      expect(cacheService.invalidateSeatMap).toHaveBeenCalledWith('SK123');
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'seat.held',
        expect.objectContaining({ seatId: '12A' })
      );
    });

    it('should throw SeatUnavailableError when seat is taken', async () => {
      const request = {
        flightId: 'SK123',
        seatId: '12A',
        passengerId: 'P12345',
      };

      seatRepository.findOneAndUpdate.mockResolvedValue(null);
      seatRepository.find.mockResolvedValue([
        { seatId: '12B' },
        { seatId: '12C' },
      ] as any);

      await expect(service.holdSeat(request)).rejects.toThrow(SeatUnavailableError);
    });
  });
});
```

#### Baggage Validator Unit Tests
**tests/unit/baggage-validator.service.spec.ts:**
```typescript
import { BaggageValidatorService } from '../../src/checkin-service/services/baggage-validator.service';
import { WeightServiceClient } from '../../src/checkin-service/clients/weight-service.client';

describe('BaggageValidatorService', () => {
  let service: BaggageValidatorService;
  let weightClient: jest.Mocked<WeightServiceClient>;

  beforeEach(() => {
    weightClient = {
      weighBag: jest.fn(),
    } as any;

    service = new BaggageValidatorService(weightClient);
  });

  it('should pass validation for bags within limit', async () => {
    weightClient.weighBag.mockResolvedValueOnce(23.5);

    const result = await service.validate(1);

    expect(result.valid).toBe(true);
    expect(result.totalFee).toBe(0);
    expect(result.bags[0].status).toBe('OK');
  });

  it('should calculate fee for overweight bags', async () => {
    weightClient.weighBag.mockResolvedValueOnce(26.5);

    const result = await service.validate(1);

    expect(result.valid).toBe(true);
    expect(result.totalFee).toBe(50);
    expect(result.bags[0].status).toBe('OVERWEIGHT');
  });

  it('should reject bags over 32kg', async () => {
    weightClient.weighBag.mockResolvedValueOnce(34.0);

    const result = await service.validate(1);

    expect(result.valid).toBe(false);
    expect(result.bags[0].status).toBe('REJECTED');
  });
});
```

#### Priority Calculator Unit Tests
**tests/unit/priority-calculator.service.spec.ts:**
```typescript
import { PriorityCalculatorService } from '../../src/waitlist-service/services/priority-calculator.service';
import { LoyaltyTier } from '../../src/shared/types/common.types';

describe('PriorityCalculatorService', () => {
  let service: PriorityCalculatorService;

  beforeEach(() => {
    service = new PriorityCalculatorService();
  });

  it('should calculate higher score for PLATINUM tier', () => {
    const platinumScore = service.calculate({
      loyaltyTier: LoyaltyTier.PLATINUM,
      bookingTimestamp: new Date('2026-02-10T00:00:00Z'),
      hasSpecialNeeds: false,
    });

    const regularScore = service.calculate({
      loyaltyTier: LoyaltyTier.REGULAR,
      bookingTimestamp: new Date('2026-02-10T00:00:00Z'),
      hasSpecialNeeds: false,
    });

    expect(platinumScore).toBeGreaterThan(regularScore);
  });

  it('should award bonus for special needs', () => {
    const withSpecialNeeds = service.calculate({
      loyaltyTier: LoyaltyTier.GOLD,
      bookingTimestamp: new Date(),
      hasSpecialNeeds: true,
    });

    const withoutSpecialNeeds = service.calculate({
      loyaltyTier: LoyaltyTier.GOLD,
      bookingTimestamp: new Date(),
      hasSpecialNeeds: false,
    });

    expect(withSpecialNeeds).toBe(withoutSpecialNeeds + 200);
  });
});
```

### 4. Integration Tests

**tests/integration/seat-service.integration.spec.ts:**
```typescript
import request from 'supertest';
import { createApp } from '../../src/seat-service/app';
import { connectDatabase, closeDatabase } from '../../src/shared/config/database';
import { Seat } from '../../src/shared/models/seat.model';
import { createMockRedis } from '../setup';

describe('Seat Service Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    await connectDatabase();
    // Initialize app with dependencies
  });

  afterAll(async () => {
    await closeDatabase();
  });

  beforeEach(async () => {
    // Seed test data
    await Seat.create({
      seatId: '12A',
      flightId: 'SK123',
      rowNumber: 12,
      columnLetter: 'A',
      seatType: 'WINDOW',
      state: 'AVAILABLE',
      price: 25,
    });
  });

  describe('GET /api/v1/flights/:flightId/seatmap', () => {
    it('should return seat map for flight', async () => {
      const response = await request(app)
        .get('/api/v1/flights/SK123/seatmap')
        .expect(200);

      expect(response.body).toHaveProperty('flightId', 'SK123');
      expect(response.body.seats).toBeInstanceOf(Array);
      expect(response.body.seats.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent flight', async () => {
      await request(app)
        .get('/api/v1/flights/INVALID/seatmap')
        .expect(404);
    });
  });

  describe('POST /api/v1/seats/hold', () => {
    it('should hold an available seat', async () => {
      const response = await request(app)
        .post('/api/v1/seats/hold')
        .send({
          flightId: 'SK123',
          seatId: '12A',
          passengerId: 'P12345',
        })
        .expect(200);

      expect(response.body).toHaveProperty('holdId');
      expect(response.body.seatId).toBe('12A');
      expect(response.body).toHaveProperty('expiresAt');
    });

    it('should return 409 for unavailable seat', async () => {
      // Hold seat first
      await request(app)
        .post('/api/v1/seats/hold')
        .send({
          flightId: 'SK123',
          seatId: '12A',
          passengerId: 'P11111',
        });

      // Try to hold again
      const response = await request(app)
        .post('/api/v1/seats/hold')
        .send({
          flightId: 'SK123',
          seatId: '12A',
          passengerId: 'P22222',
        })
        .expect(409);

      expect(response.body.error.code).toBe('SEAT_UNAVAILABLE');
      expect(response.body.error.suggestions).toBeInstanceOf(Array);
    });

    it('should return 400 for invalid seat ID format', async () => {
      const response = await request(app)
        .post('/api/v1/seats/hold')
        .send({
          flightId: 'SK123',
          seatId: 'INVALID',
          passengerId: 'P12345',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

### 5. End-to-End Tests

**tests/e2e/checkin-flow.e2e.spec.ts:**
```typescript
import request from 'supertest';
import { Seat } from '../../src/shared/models/seat.model';

describe('Complete Check-In Flow (E2E)', () => {
  beforeAll(async () => {
    // Seed test data
    await Seat.insertMany([
      {
        seatId: '10A',
        flightId: 'SK123',
        rowNumber: 10,
        columnLetter: 'A',
        seatType: 'WINDOW',
        state: 'AVAILABLE',
        price: 25,
      },
      // ... more seats
    ]);
  });

  it('should complete full check-in flow without payment', async () => {
    const API_URL = 'http://localhost:3000/api/v1';

    // 1. Login
    const loginRes = await request(API_URL)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    const token = loginRes.body.token;
    expect(token).toBeDefined();

    // 2. Get seat map
    const seatMapRes = await request(API_URL)
      .get('/flights/SK123/seatmap')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(seatMapRes.body.seats.length).toBeGreaterThan(0);

    // 3. Start check-in
    const startRes = await request(API_URL)
      .post('/checkin/start')
      .set('Authorization', `Bearer ${token}`)
      .send({
        passengerId: 'P12345',
        userId: 'U_test',
        bookingId: 'BK789',
      })
      .expect(200);

    const checkInId = startRes.body.checkInId;

    // 4. Complete check-in (no baggage)
    const completeRes = await request(API_URL)
      .post('/checkin/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({
        checkInId,
        passengerId: 'P12345',
        userId: 'U_test',
        seatId: '10A',
        baggage: { count: 0 },
      })
      .expect(200);

    expect(completeRes.body.state).toBe('COMPLETED');
    expect(completeRes.body.boardingPass).toBeDefined();
    expect(completeRes.body.boardingPass.qrCode).toBeDefined();
  });

  it('should handle check-in with payment flow', async () => {
    // This test requires mocking Weight Service to return overweight bags
    // and Payment Service to confirm payment

    // Test steps:
    // 1. Login
    // 2. Start check-in
    // 3. Complete with baggage → should return AWAITING_PAYMENT
    // 4. Confirm payment
    // 5. Verify check-in completed automatically
  });
});
```

### 6. Concurrency Tests

**tests/integration/seat-concurrency.spec.ts:**
```typescript
import { Seat } from '../../src/shared/models/seat.model';
import { SeatHoldService } from '../../src/seat-service/services/seat-hold.service';

describe('Seat Concurrency Tests', () => {
  let service: SeatHoldService;

  beforeEach(async () => {
    // Seed a single available seat
    await Seat.create({
      seatId: '15C',
      flightId: 'SK123',
      rowNumber: 15,
      columnLetter: 'C',
      seatType: 'AISLE',
      state: 'AVAILABLE',
      price: 25,
    });
  });

  it('should handle 100 concurrent hold requests - exactly 1 succeeds', async () => {
    const promises = [];

    // Create 100 concurrent hold requests
    for (let i = 0; i < 100; i++) {
      promises.push(
        service.holdSeat({
          flightId: 'SK123',
          seatId: '15C',
          passengerId: `P${i}`,
        }).catch((error) => error)
      );
    }

    const results = await Promise.all(promises);

    // Count successes vs failures
    const successes = results.filter((r) => r.holdId !== undefined);
    const failures = results.filter((r) => r instanceof Error);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(99);

    // Verify seat is held by one passenger
    const seat = await Seat.findOne({ seatId: '15C', flightId: 'SK123' });
    expect(seat?.state).toBe('HELD');
    expect(seat?.heldByPassengerId).toBeDefined();
  });
});
```

### 7. Test Scripts

**package.json scripts:**
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

### 8. Test Data Factories

**tests/factories/seat.factory.ts:**
```typescript
import { Seat } from '../../src/shared/models/seat.model';

export const createSeat = async (overrides?: Partial<any>) => {
  return Seat.create({
    seatId: '12A',
    flightId: 'SK123',
    rowNumber: 12,
    columnLetter: 'A',
    seatType: 'WINDOW',
    state: 'AVAILABLE',
    price: 25,
    ...overrides,
  });
};

export const createMultipleSeats = async (count: number, flightId = 'SK123') => {
  const seats = [];
  for (let i = 1; i <= count; i++) {
    const col = String.fromCharCode(65 + (i % 6)); // A-F
    seats.push({
      seatId: `${i}${col}`,
      flightId,
      rowNumber: i,
      columnLetter: col,
      seatType: 'WINDOW',
      state: 'AVAILABLE',
      price: 25,
    });
  }
  return Seat.insertMany(seats);
};
```

## Implementation Steps

1. Install testing dependencies (Jest, Supertest, mongodb-memory-server)
2. Configure Jest with TypeScript support
3. Create test setup file with MongoDB and Redis mocks
4. Write unit tests for all service classes
5. Write integration tests for all API endpoints
6. Create concurrency tests for race conditions
7. Write end-to-end tests for complete flows
8. Create test factories for data generation
9. Set up CI test scripts
10. Generate coverage reports

## Testing Strategy

### Run Tests:

**All Tests:**
```bash
npm test
```

**Unit Tests Only:**
```bash
npm run test:unit
```

**Integration Tests:**
```bash
npm run test:integration
```

**Watch Mode (during development):**
```bash
npm run test:watch
```

**Coverage Report:**
```bash
npm run test:coverage
```

### Verification Checklist:
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Concurrency tests verify atomicity
- [ ] E2E tests cover happy path
- [ ] Code coverage > 70% for all metrics
- [ ] Tests run in CI environment
- [ ] Test database isolated from development
- [ ] Mock services used where appropriate
- [ ] Test factories generate valid data

## Expected Outputs
- Comprehensive test suite with 100+ tests
- Unit tests for all service classes
- Integration tests for all API endpoints
- Concurrency tests for race conditions
- E2E tests for complete user flows
- Code coverage reports
- CI-ready test configuration

## Estimated Complexity
**High** - Comprehensive testing requires understanding all components.

## Dependencies
- Task 001-010 (All services implemented)

## Next Tasks
- Task 014: Load Testing Setup
- Task 015: API Documentation
