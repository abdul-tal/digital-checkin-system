# Task 004: Check-In Service Implementation

## Objective
Implement the Check-In Service to orchestrate the complete check-in flow, including seat selection, baggage validation, payment integration, and boarding pass generation.

## Priority
P0 (Must Have) - Core user-facing functionality

## Description
Build the Check-In Service that coordinates with Seat Service, Weight Service, and Payment Service to complete the check-in process. Manages check-in state transitions and handles payment workflows.

## Prerequisites
- Task 001 completed (Project setup)
- Task 002 completed (Database schemas)
- Task 003 completed (Seat Service running)

## Technical Requirements

### 1. Directory Structure

```
src/checkin-service/
├── controllers/
│   └── checkin.controller.ts           # HTTP handlers
├── services/
│   ├── checkin-orchestrator.service.ts # Main orchestration logic
│   ├── baggage-validator.service.ts    # Baggage validation
│   └── boarding-pass.service.ts        # Boarding pass generation
├── repositories/
│   └── checkin.repository.ts           # MongoDB data access
├── events/
│   ├── publishers/
│   │   └── checkin.publisher.ts        # Publish check-in events
│   └── subscribers/
│       ├── payment.subscriber.ts       # Listen for payment events
│       └── seat.subscriber.ts          # Listen for seat events
├── validators/
│   └── checkin.validator.ts            # Request validation
├── routes/
│   └── checkin.routes.ts               # Route definitions
├── clients/
│   ├── seat-service.client.ts          # HTTP client for Seat Service
│   ├── payment-service.client.ts       # HTTP client for Payment Service
│   └── weight-service.client.ts        # HTTP client for Weight Service
├── app.ts                              # Express app setup
└── index.ts                            # Entry point
```

### 2. Check-In Repository

**src/checkin-service/repositories/checkin.repository.ts:**
```typescript
import { CheckIn, ICheckIn } from '../../shared/models/checkin.model';
import { FilterQuery, UpdateQuery } from 'mongoose';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('checkin-repository');

export class CheckInRepository {
  async create(data: Partial<ICheckIn>): Promise<ICheckIn> {
    const checkin = new CheckIn(data);
    await checkin.save();
    logger.debug('Check-in created', { checkInId: checkin.checkInId });
    return checkin;
  }

  async findOne(filter: FilterQuery<ICheckIn>): Promise<ICheckIn | null> {
    return CheckIn.findOne(filter);
  }

  async findById(checkInId: string): Promise<ICheckIn | null> {
    return CheckIn.findOne({ checkInId });
  }

  async updateOne(
    filter: FilterQuery<ICheckIn>,
    update: UpdateQuery<ICheckIn>
  ): Promise<void> {
    await CheckIn.updateOne(filter, update);
    logger.debug('Check-in updated', { filter });
  }

  async findByPassengerAndFlight(
    passengerId: string,
    flightId: string
  ): Promise<ICheckIn | null> {
    return CheckIn.findOne({ passengerId, flightId }).sort({ createdAt: -1 });
  }
}
```

### 3. Service Clients (HTTP Communication)

**src/checkin-service/clients/seat-service.client.ts:**
```typescript
import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('seat-service-client');

export interface HoldSeatRequest {
  flightId: string;
  seatId: string;
  passengerId: string;
}

export interface HoldSeatResponse {
  holdId: string;
  seatId: string;
  expiresAt: Date;
  remainingSeconds: number;
}

export class SeatServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.SEAT_SERVICE_URL || 'http://localhost:3001',
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async holdSeat(req: HoldSeatRequest): Promise<HoldSeatResponse> {
    try {
      const response = await this.client.post('/api/v1/seats/hold', req);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to hold seat', { error: error.message });
      throw error;
    }
  }

  async confirmSeat(seatId: string, flightId: string, passengerId: string): Promise<void> {
    try {
      await this.client.post('/api/v1/seats/confirm', {
        seatId,
        flightId,
        passengerId,
      });
    } catch (error: any) {
      logger.error('Failed to confirm seat', { error: error.message });
      throw error;
    }
  }

  async releaseSeat(seatId: string, flightId: string): Promise<void> {
    try {
      await this.client.post('/api/v1/seats/release', { seatId, flightId });
    } catch (error: any) {
      logger.error('Failed to release seat', { error: error.message });
      throw error;
    }
  }
}
```

**src/checkin-service/clients/payment-service.client.ts:**
```typescript
import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('payment-service-client');

export interface InitiatePaymentRequest {
  amount: number;
  passengerId: string;
  checkInId: string;
}

export interface PaymentResponse {
  paymentId: string;
  paymentUrl: string;
  expiresAt: Date;
}

export class PaymentServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003',
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async initiatePayment(req: InitiatePaymentRequest): Promise<PaymentResponse> {
    try {
      const response = await this.client.post('/api/v1/payments/initiate', req);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to initiate payment', { error: error.message });
      throw error;
    }
  }

  async getPaymentStatus(paymentId: string): Promise<string> {
    try {
      const response = await this.client.get(`/api/v1/payments/${paymentId}/status`);
      return response.data.status;
    } catch (error: any) {
      logger.error('Failed to get payment status', { error: error.message });
      throw error;
    }
  }
}
```

**src/checkin-service/clients/weight-service.client.ts:**
```typescript
import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('weight-service-client');

export interface WeighBagResponse {
  bagId: string;
  weight: number;
  measuredAt: Date;
}

export class WeightServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.WEIGHT_SERVICE_URL || 'http://localhost:3006',
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async weighBag(bagId: string): Promise<number> {
    try {
      const response = await this.client.post('/api/v1/baggage/weigh', { bagId });
      return response.data.weight;
    } catch (error: any) {
      logger.error('Failed to weigh bag', { error: error.message });
      // Fallback: return 0 if weight service unavailable
      return 0;
    }
  }
}
```

### 4. Baggage Validator Service

**src/checkin-service/services/baggage-validator.service.ts:**
```typescript
import { WeightServiceClient } from '../clients/weight-service.client';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('baggage-validator');

export interface BagValidationResult {
  bagIndex: number;
  weight: number;
  status: 'OK' | 'OVERWEIGHT' | 'REJECTED';
  fee: number;
  reason?: string;
}

export interface BaggageValidation {
  valid: boolean;
  totalFee: number;
  bags: BagValidationResult[];
}

export class BaggageValidatorService {
  private readonly WEIGHT_LIMIT = 25; // kg
  private readonly MAX_WEIGHT = 32; // kg

  constructor(private weightClient: WeightServiceClient) {}

  async validate(bagCount: number): Promise<BaggageValidation> {
    const bags: BagValidationResult[] = [];

    for (let i = 0; i < bagCount; i++) {
      const bagId = `bag-${Date.now()}-${i}`;
      const weight = await this.weightClient.weighBag(bagId);

      let result: BagValidationResult;

      if (weight > this.MAX_WEIGHT) {
        result = {
          bagIndex: i,
          weight,
          status: 'REJECTED',
          fee: 0,
          reason: `Exceeds maximum weight limit of ${this.MAX_WEIGHT}kg`,
        };
      } else if (weight > this.WEIGHT_LIMIT) {
        result = {
          bagIndex: i,
          weight,
          status: 'OVERWEIGHT',
          fee: this.calculateFee(weight),
        };
      } else {
        result = {
          bagIndex: i,
          weight,
          status: 'OK',
          fee: 0,
        };
      }

      bags.push(result);
      logger.info('Bag validated', result);
    }

    const hasRejected = bags.some((b) => b.status === 'REJECTED');
    const totalFee = bags
      .filter((b) => b.status === 'OVERWEIGHT')
      .reduce((sum, b) => sum + b.fee, 0);

    return {
      valid: !hasRejected,
      totalFee,
      bags,
    };
  }

  private calculateFee(weight: number): number {
    if (weight <= 25) return 0;
    if (weight <= 28) return 50;
    if (weight <= 32) return 100;
    return 0;
  }
}
```

### 5. Boarding Pass Service

**src/checkin-service/services/boarding-pass.service.ts:**
```typescript
import QRCode from 'qrcode';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('boarding-pass-service');

export interface BoardingPassData {
  passengerId: string;
  flightId: string;
  seatId: string;
  gate?: string;
  boardingTime?: Date;
}

export interface BoardingPass {
  passengerId: string;
  flightId: string;
  seatId: string;
  gate: string;
  boardingTime: Date;
  qrCode: string;
}

export class BoardingPassService {
  async generate(data: BoardingPassData): Promise<BoardingPass> {
    // In production, this would fetch gate and boarding time from flight operations system
    const gate = data.gate || 'B12';
    const boardingTime = data.boardingTime || new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now

    // Generate QR code with check-in data
    const qrData = JSON.stringify({
      passengerId: data.passengerId,
      flightId: data.flightId,
      seatId: data.seatId,
      gate,
      boardingTime,
      issuedAt: new Date(),
    });

    const qrCode = await QRCode.toDataURL(qrData);

    logger.info('Boarding pass generated', {
      passengerId: data.passengerId,
      flightId: data.flightId,
      seatId: data.seatId,
    });

    return {
      passengerId: data.passengerId,
      flightId: data.flightId,
      seatId: data.seatId,
      gate,
      boardingTime,
      qrCode,
    };
  }
}
```

### 6. Check-In Orchestrator Service

**src/checkin-service/services/checkin-orchestrator.service.ts:**
```typescript
import { v4 as uuid } from 'uuid';
import { CheckInRepository } from '../repositories/checkin.repository';
import { BaggageValidatorService } from './baggage-validator.service';
import { BoardingPassService } from './boarding-pass.service';
import { SeatServiceClient } from '../clients/seat-service.client';
import { PaymentServiceClient } from '../clients/payment-service.client';
import { CheckInPublisher } from '../events/publishers/checkin.publisher';
import { CheckInState } from '../../shared/types/common.types';
import { createLogger } from '../../shared/utils/logger';
import { AppError } from '../../shared/errors/app-error';

const logger = createLogger('checkin-orchestrator');

export interface StartCheckInRequest {
  passengerId: string;
  userId: string;
  bookingId: string;
}

export interface CompleteCheckInRequest {
  checkInId: string;
  passengerId: string;
  userId: string;
  seatId: string;
  baggage: {
    count: number;
  };
}

export class CheckInOrchestratorService {
  constructor(
    private checkinRepository: CheckInRepository,
    private baggageValidator: BaggageValidatorService,
    private boardingPassService: BoardingPassService,
    private seatClient: SeatServiceClient,
    private paymentClient: PaymentServiceClient,
    private eventPublisher: CheckInPublisher
  ) {}

  async startCheckIn(req: StartCheckInRequest) {
    // For now, we'll use a mock flight ID
    // In production, this would fetch from booking service
    const flightId = 'SK123';

    const checkInId = `ci_${uuid()}`;

    const checkin = await this.checkinRepository.create({
      checkInId,
      userId: req.userId,
      passengerId: req.passengerId,
      flightId,
      state: CheckInState.IN_PROGRESS,
      createdAt: new Date(),
    });

    logger.info('Check-in started', { checkInId, passengerId: req.passengerId });

    return {
      checkInId: checkin.checkInId,
      state: CheckInState.IN_PROGRESS,
      flightId,
    };
  }

  async completeCheckIn(req: CompleteCheckInRequest) {
    const checkin = await this.checkinRepository.findById(req.checkInId);

    if (!checkin) {
      throw new AppError(404, 'CHECKIN_NOT_FOUND', 'Check-in not found');
    }

    if (checkin.passengerId !== req.passengerId) {
      throw new AppError(403, 'FORBIDDEN', 'Passenger mismatch');
    }

    // Step 1: Hold the seat
    try {
      await this.seatClient.holdSeat({
        flightId: checkin.flightId,
        seatId: req.seatId,
        passengerId: req.passengerId,
      });

      // Update check-in with seat ID
      await this.checkinRepository.updateOne(
        { checkInId: req.checkInId },
        { $set: { seatId: req.seatId } }
      );
    } catch (error: any) {
      logger.error('Failed to hold seat', { error });
      throw new AppError(409, 'SEAT_UNAVAILABLE', 'Failed to hold seat');
    }

    // Step 2: Validate baggage
    const baggageValidation = await this.baggageValidator.validate(req.baggage.count);

    if (!baggageValidation.valid) {
      // Baggage rejected (too heavy) - release seat
      await this.seatClient.releaseSeat(req.seatId, checkin.flightId);
      throw new AppError(
        400,
        'BAGGAGE_TOO_HEAVY',
        'One or more bags exceed the maximum weight limit',
        { bags: baggageValidation.bags }
      );
    }

    // Step 3: Check if payment required
    if (baggageValidation.totalFee > 0) {
      const payment = await this.paymentClient.initiatePayment({
        amount: baggageValidation.totalFee,
        passengerId: req.passengerId,
        checkInId: req.checkInId,
      });

      // Update check-in to awaiting payment
      await this.checkinRepository.updateOne(
        { checkInId: req.checkInId },
        {
          $set: {
            state: CheckInState.AWAITING_PAYMENT,
            'baggage.count': req.baggage.count,
            'baggage.weights': baggageValidation.bags.map((b) => b.weight),
            'baggage.fee': baggageValidation.totalFee,
            paymentUrl: payment.paymentUrl,
          },
        }
      );

      logger.info('Check-in awaiting payment', {
        checkInId: req.checkInId,
        fee: baggageValidation.totalFee,
      });

      return {
        checkInId: req.checkInId,
        state: CheckInState.AWAITING_PAYMENT,
        baggageFee: baggageValidation.totalFee,
        paymentUrl: payment.paymentUrl,
        expiresAt: payment.expiresAt,
      };
    }

    // Step 4: No payment needed - complete check-in
    return this.finalizeCheckIn(checkin, baggageValidation);
  }

  private async finalizeCheckIn(checkin: any, baggageValidation: any) {
    // Confirm seat
    await this.seatClient.confirmSeat(
      checkin.seatId,
      checkin.flightId,
      checkin.passengerId
    );

    // Generate boarding pass
    const boardingPass = await this.boardingPassService.generate({
      passengerId: checkin.passengerId,
      flightId: checkin.flightId,
      seatId: checkin.seatId,
    });

    // Update check-in to completed
    await this.checkinRepository.updateOne(
      { checkInId: checkin.checkInId },
      {
        $set: {
          state: CheckInState.COMPLETED,
          'baggage.count': baggageValidation.bags.length,
          'baggage.weights': baggageValidation.bags.map((b: any) => b.weight),
          'baggage.fee': baggageValidation.totalFee,
          boardingPass,
          completedAt: new Date(),
        },
      }
    );

    // Publish event
    await this.eventPublisher.publish('checkin.completed', {
      checkInId: checkin.checkInId,
      passengerId: checkin.passengerId,
      flightId: checkin.flightId,
      seatId: checkin.seatId,
    });

    logger.info('Check-in completed', { checkInId: checkin.checkInId });

    return {
      checkInId: checkin.checkInId,
      state: CheckInState.COMPLETED,
      boardingPass,
    };
  }

  async cancelCheckIn(checkInId: string, passengerId: string) {
    const checkin = await this.checkinRepository.findById(checkInId);

    if (!checkin) {
      throw new AppError(404, 'CHECKIN_NOT_FOUND', 'Check-in not found');
    }

    if (checkin.passengerId !== passengerId) {
      throw new AppError(403, 'FORBIDDEN', 'Passenger mismatch');
    }

    if (checkin.state !== CheckInState.COMPLETED) {
      throw new AppError(400, 'INVALID_STATE', 'Check-in is not completed');
    }

    // Check cancellation window (2 hours before departure)
    // For now, allow all cancellations
    // In production, fetch flight departure time and validate

    // Release seat
    if (checkin.seatId) {
      await this.seatClient.releaseSeat(checkin.seatId, checkin.flightId);
    }

    // Update check-in state
    await this.checkinRepository.updateOne(
      { checkInId },
      {
        $set: {
          state: CheckInState.CANCELLED,
          updatedAt: new Date(),
        },
      }
    );

    // Publish event
    await this.eventPublisher.publish('checkin.cancelled', {
      checkInId,
      passengerId,
      flightId: checkin.flightId,
      seatId: checkin.seatId,
    });

    logger.info('Check-in cancelled', { checkInId });

    return {
      checkInId,
      state: CheckInState.CANCELLED,
      seatId: checkin.seatId,
    };
  }

  // Handle payment confirmation event
  async handlePaymentConfirmed(paymentEvent: any) {
    const checkin = await this.checkinRepository.findOne({
      checkInId: paymentEvent.checkInId,
      state: CheckInState.AWAITING_PAYMENT,
    });

    if (!checkin) {
      logger.warn('Check-in not found or not awaiting payment', { paymentEvent });
      return;
    }

    logger.info('Payment confirmed, finalizing check-in', {
      checkInId: checkin.checkInId,
    });

    // Resume check-in flow
    const baggageValidation = {
      valid: true,
      totalFee: checkin.baggage?.fee || 0,
      bags: checkin.baggage?.weights.map((w, i) => ({
        bagIndex: i,
        weight: w,
        status: 'OVERWEIGHT' as const,
        fee: 0,
      })) || [],
    };

    await this.finalizeCheckIn(checkin, baggageValidation);
  }
}
```

### 7. Controllers

**src/checkin-service/controllers/checkin.controller.ts:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { CheckInOrchestratorService } from '../services/checkin-orchestrator.service';

export class CheckInController {
  constructor(private orchestrator: CheckInOrchestratorService) {}

  startCheckIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { passengerId, userId, bookingId } = req.body;
      const result = await this.orchestrator.startCheckIn({
        passengerId,
        userId,
        bookingId,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  completeCheckIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { checkInId, passengerId, userId, seatId, baggage } = req.body;
      const result = await this.orchestrator.completeCheckIn({
        checkInId,
        passengerId,
        userId,
        seatId,
        baggage,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  cancelCheckIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { checkInId } = req.params;
      const { passengerId } = req.body;
      const result = await this.orchestrator.cancelCheckIn(checkInId, passengerId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
```

### 8. Routes

**src/checkin-service/routes/checkin.routes.ts:**
```typescript
import { Router } from 'express';
import { CheckInController } from '../controllers/checkin.controller';

export const createCheckInRoutes = (controller: CheckInController): Router => {
  const router = Router();

  router.post('/checkin/start', controller.startCheckIn);
  router.post('/checkin/complete', controller.completeCheckIn);
  router.post('/checkin/:checkInId/cancel', controller.cancelCheckIn);

  return router;
};
```

### 9. Event Subscribers

**src/checkin-service/events/subscribers/payment.subscriber.ts:**
```typescript
import { EventBus, Event } from '../../../shared/events/event-bus';
import { CheckInOrchestratorService } from '../../services/checkin-orchestrator.service';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('payment-subscriber');

export class PaymentSubscriber {
  constructor(
    private eventBus: EventBus,
    private orchestrator: CheckInOrchestratorService
  ) {}

  start(): void {
    this.eventBus.subscribe('payment.confirmed', this.handlePaymentConfirmed.bind(this));
    logger.info('Payment subscriber started');
  }

  private async handlePaymentConfirmed(event: Event): Promise<void> {
    logger.info('Payment confirmed event received', { eventId: event.eventId });
    await this.orchestrator.handlePaymentConfirmed(event.data);
  }
}
```

### 10. Service Entry Point

**src/checkin-service/index.ts:**
```typescript
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { connectDatabase } from '../shared/config/database';
import { createPubSubClients, createRedisClient } from '../shared/config/redis';
import { EventBus } from '../shared/events/event-bus';
import { CheckInRepository } from './repositories/checkin.repository';
import { CheckInOrchestratorService } from './services/checkin-orchestrator.service';
import { BaggageValidatorService } from './services/baggage-validator.service';
import { BoardingPassService } from './services/boarding-pass.service';
import { SeatServiceClient } from './clients/seat-service.client';
import { PaymentServiceClient } from './clients/payment-service.client';
import { WeightServiceClient } from './clients/weight-service.client';
import { CheckInController } from './controllers/checkin.controller';
import { CheckInPublisher } from './events/publishers/checkin.publisher';
import { PaymentSubscriber } from './events/subscribers/payment.subscriber';
import { createCheckInRoutes } from './routes/checkin.routes';
import { errorHandler } from '../shared/middleware/error-handler';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('checkin-service');
const PORT = process.env.CHECKIN_SERVICE_PORT || 3002;

async function bootstrap() {
  try {
    await connectDatabase();

    const { publisher, subscriber } = createPubSubClients();
    const eventBus = new EventBus(publisher, subscriber);

    // Initialize services
    const checkinRepository = new CheckInRepository();
    const weightClient = new WeightServiceClient();
    const baggageValidator = new BaggageValidatorService(weightClient);
    const boardingPassService = new BoardingPassService();
    const seatClient = new SeatServiceClient();
    const paymentClient = new PaymentServiceClient();
    const eventPublisher = new CheckInPublisher(eventBus);

    const orchestrator = new CheckInOrchestratorService(
      checkinRepository,
      baggageValidator,
      boardingPassService,
      seatClient,
      paymentClient,
      eventPublisher
    );

    // Initialize controller
    const controller = new CheckInController(orchestrator);

    // Create Express app
    const app = express();
    app.use(express.json());
    app.use('/api/v1', createCheckInRoutes(controller));
    app.get('/health', (req, res) => {
      res.json({ status: 'OK', service: 'checkin-service' });
    });
    app.use(errorHandler);

    // Start event subscribers
    const paymentSubscriber = new PaymentSubscriber(eventBus, orchestrator);
    paymentSubscriber.start();

    // Start server
    app.listen(PORT, () => {
      logger.info(`Check-In Service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Check-In Service', { error });
    process.exit(1);
  }
}

bootstrap();
```

## Implementation Steps

1. Create all service directories
2. Implement service clients for Seat, Payment, Weight services
3. Implement baggage validator service
4. Implement boarding pass generator (QR code)
5. Implement check-in orchestrator with state management
6. Create repository for check-in data access
7. Implement controllers and routes
8. Set up event subscribers for payment events
9. Create Express app and start service
10. Add error handling

## Testing Strategy

### Manual Testing After Completion:

**Test 1: Start Check-In**
```bash
curl -X POST http://localhost:3002/api/v1/checkin/start \
  -H "Content-Type: application/json" \
  -d '{
    "passengerId": "P12345",
    "userId": "U12345",
    "bookingId": "BK789"
  }'
```
Expected: Returns checkInId and state: IN_PROGRESS

**Test 2: Complete Check-In (No Baggage)**
```bash
curl -X POST http://localhost:3002/api/v1/checkin/complete \
  -H "Content-Type: application/json" \
  -d '{
    "checkInId": "<checkInId from step 1>",
    "passengerId": "P12345",
    "userId": "U12345",
    "seatId": "10A",
    "baggage": { "count": 0 }
  }'
```
Expected: Returns COMPLETED with boarding pass and QR code

**Test 3: Complete Check-In (With Overweight Baggage)**
This will be fully testable after implementing Weight Service (Task 005) and Payment Service (Task 006).

### Verification Checklist:
- [ ] Check-In Service starts on port 3002
- [ ] Start check-in creates record in MongoDB
- [ ] Complete check-in communicates with Seat Service
- [ ] Boarding pass generated with QR code
- [ ] Check-in state transitions correctly
- [ ] Baggage validation works
- [ ] Payment subscriber listens for events
- [ ] Error handling returns proper error codes
- [ ] Health endpoint returns OK

## Expected Outputs
- Working Check-In Service on port 3002
- Start check-in API functional
- Complete check-in API functional (basic flow)
- Cancel check-in API functional
- Boarding pass generation with QR code
- Event-driven payment handling
- Service-to-service communication established

## Estimated Complexity
**High** - Orchestrates multiple services and handles complex state transitions.

## Dependencies
- Task 001 (Project setup)
- Task 002 (Database schemas)
- Task 003 (Seat Service running)

## Next Tasks
- Task 005: Mock Weight Service (required for baggage validation)
- Task 006: Mock Payment Service (required for payment flow)
- After Task 006, you'll have a COMPLETE END-TO-END check-in flow to test!
