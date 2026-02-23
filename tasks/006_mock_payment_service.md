# Task 006: Mock Payment Service Implementation

## Objective
Implement a mock Payment Service that simulates payment processing with configurable success rates, delays, and webhook callbacks to complete the check-in flow.

## Priority
P0 (Must Have) - Required for baggage fee payment flow

## Description
Build a mock payment service that generates payment URLs, simulates payment confirmation with configurable delays, and publishes payment events to Resume check-in flow after payment.

## Prerequisites
- Task 001 completed (Project setup)
- Task 002 completed (Database schemas with Payment model)
- Task 004 completed (Check-In Service awaiting payment events)

## Technical Requirements

### 1. Directory Structure

```
src/payment-service/
├── controllers/
│   └── payment.controller.ts
├── services/
│   └── mock-payment.service.ts
├── repositories/
│   └── payment.repository.ts
├── events/
│   └── publishers/
│       └── payment.publisher.ts
├── routes/
│   └── payment.routes.ts
├── app.ts
└── index.ts
```

### 2. Payment Repository

**src/payment-service/repositories/payment.repository.ts:**
```typescript
import { Payment, IPayment } from '../../shared/models/payment.model';
import { FilterQuery, UpdateQuery } from 'mongoose';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('payment-repository');

export class PaymentRepository {
  async create(data: Partial<IPayment>): Promise<IPayment> {
    const payment = new Payment(data);
    await payment.save();
    logger.debug('Payment created', { paymentId: payment.paymentId });
    return payment;
  }

  async findOne(filter: FilterQuery<IPayment>): Promise<IPayment | null> {
    return Payment.findOne(filter);
  }

  async findById(paymentId: string): Promise<IPayment | null> {
    return Payment.findOne({ paymentId });
  }

  async updateOne(
    filter: FilterQuery<IPayment>,
    update: UpdateQuery<IPayment>
  ): Promise<void> {
    await Payment.updateOne(filter, update);
    logger.debug('Payment updated', { filter });
  }
}
```

### 3. Mock Payment Service

**src/payment-service/services/mock-payment.service.ts:**
```typescript
import { v4 as uuid } from 'uuid';
import { PaymentRepository } from '../repositories/payment.repository';
import { PaymentPublisher } from '../events/publishers/payment.publisher';
import { createLogger } from '../../shared/utils/logger';
import { AppError } from '../../shared/errors/app-error';

const logger = createLogger('mock-payment-service');

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

export interface PaymentConfirmation {
  status: 'COMPLETED' | 'FAILED';
  transactionId?: string;
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export class MockPaymentService {
  private readonly delay: number;
  private readonly successRate: number;
  private readonly expiryMinutes: number;

  constructor(
    private paymentRepository: PaymentRepository,
    private eventPublisher: PaymentPublisher
  ) {
    this.delay = parseInt(process.env.MOCK_PAYMENT_DELAY_MS || '1000');
    this.successRate = parseFloat(process.env.MOCK_PAYMENT_SUCCESS_RATE || '1.0');
    this.expiryMinutes = parseInt(process.env.PAYMENT_EXPIRY_MINUTES || '30');
  }

  async initiatePayment(req: InitiatePaymentRequest): Promise<PaymentResponse> {
    if (req.amount <= 0) {
      throw new AppError(400, 'INVALID_AMOUNT', 'Payment amount must be positive');
    }

    const paymentId = `pay_${uuid()}`;
    const expiresAt = new Date(Date.now() + this.expiryMinutes * 60 * 1000);

    // In production, this would be the actual payment gateway URL
    const paymentUrl = `${process.env.PAYMENT_BASE_URL || 'http://localhost:3003'}/pay/${paymentId}`;

    // Store payment request
    await this.paymentRepository.create({
      paymentId,
      checkInId: req.checkInId,
      passengerId: req.passengerId,
      amount: req.amount,
      status: PaymentStatus.PENDING,
      expiresAt,
      createdAt: new Date(),
    });

    logger.info('Payment initiated', {
      paymentId,
      amount: req.amount,
      checkInId: req.checkInId,
    });

    return {
      paymentId,
      paymentUrl,
      expiresAt,
    };
  }

  async confirmPayment(paymentId: string): Promise<PaymentConfirmation> {
    const payment = await this.paymentRepository.findById(paymentId);

    if (!payment) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new AppError(
        400,
        'PAYMENT_ALREADY_PROCESSED',
        `Payment already ${payment.status.toLowerCase()}`
      );
    }

    // Check if payment expired
    if (new Date() > payment.expiresAt) {
      await this.paymentRepository.updateOne(
        { paymentId },
        { $set: { status: PaymentStatus.EXPIRED } }
      );
      throw new AppError(400, 'PAYMENT_EXPIRED', 'Payment link has expired');
    }

    // Simulate processing delay
    await this.sleep(this.delay);

    // Simulate success/failure based on config
    const success = Math.random() < this.successRate;
    const status = success ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;
    const transactionId = success ? `txn_${uuid()}` : undefined;

    // Update payment record
    await this.paymentRepository.updateOne(
      { paymentId },
      {
        $set: {
          status,
          transactionId,
          completedAt: new Date(),
        },
      }
    );

    logger.info('Payment processed', {
      paymentId,
      status,
      transactionId,
      amount: payment.amount,
    });

    // Publish event if successful
    if (success) {
      await this.eventPublisher.publish('payment.confirmed', {
        paymentId,
        checkInId: payment.checkInId,
        passengerId: payment.passengerId,
        amount: payment.amount,
        transactionId,
      });
    } else {
      await this.eventPublisher.publish('payment.failed', {
        paymentId,
        checkInId: payment.checkInId,
      });
    }

    return {
      status: status as 'COMPLETED' | 'FAILED',
      transactionId,
    };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    const payment = await this.paymentRepository.findById(paymentId);

    if (!payment) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    }

    return payment.status as PaymentStatus;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 4. Controller

**src/payment-service/controllers/payment.controller.ts:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { MockPaymentService } from '../services/mock-payment.service';
import { ValidationError } from '../../shared/errors/app-error';

export class PaymentController {
  constructor(private paymentService: MockPaymentService) {}

  initiatePayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, passengerId, checkInId } = req.body;

      if (!amount || !passengerId || !checkInId) {
        throw new ValidationError('Missing required fields');
      }

      const result = await this.paymentService.initiatePayment({
        amount,
        passengerId,
        checkInId,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  confirmPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { paymentId } = req.params;

      const result = await this.paymentService.confirmPayment(paymentId);

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getPaymentStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { paymentId } = req.params;

      const status = await this.paymentService.getPaymentStatus(paymentId);

      res.json({ paymentId, status });
    } catch (error) {
      next(error);
    }
  };

  // Mock payment page (for testing)
  renderPaymentPage = async (req: Request, res: Response) => {
    const { paymentId } = req.params;

    // Simple HTML page for testing
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mock Payment - SkyHigh</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }
            .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
            button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
            button:hover { background: #0056b3; }
            .info { background: #f0f0f0; padding: 10px; border-radius: 4px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>🛫 SkyHigh Mock Payment</h2>
            <div class="info">
              <p><strong>Payment ID:</strong> ${paymentId}</p>
              <p>This is a mock payment page for testing purposes.</p>
            </div>
            <button onclick="confirmPayment()">Confirm Payment</button>
            <p id="result"></p>
          </div>
          <script>
            async function confirmPayment() {
              try {
                const response = await fetch('/api/v1/payments/${paymentId}/confirm', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();
                
                if (data.status === 'COMPLETED') {
                  document.getElementById('result').innerHTML = 
                    '<p style="color: green;">✅ Payment successful! Transaction ID: ' + data.transactionId + '</p>' +
                    '<p>You can close this page and return to the check-in flow.</p>';
                } else {
                  document.getElementById('result').innerHTML = 
                    '<p style="color: red;">❌ Payment failed. Please try again.</p>';
                }
              } catch (error) {
                document.getElementById('result').innerHTML = 
                  '<p style="color: red;">❌ Error: ' + error.message + '</p>';
              }
            }
          </script>
        </body>
      </html>
    `);
  };
}
```

### 5. Routes

**src/payment-service/routes/payment.routes.ts:**
```typescript
import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';

export const createPaymentRoutes = (controller: PaymentController): Router => {
  const router = Router();

  // API routes
  router.post('/payments/initiate', controller.initiatePayment);
  router.post('/payments/:paymentId/confirm', controller.confirmPayment);
  router.get('/payments/:paymentId/status', controller.getPaymentStatus);

  // Mock payment page (for testing in browser)
  router.get('/pay/:paymentId', controller.renderPaymentPage);

  return router;
};
```

### 6. Event Publisher

**src/payment-service/events/publishers/payment.publisher.ts:**
```typescript
import { EventBus } from '../../../shared/events/event-bus';

export class PaymentPublisher {
  constructor(private eventBus: EventBus) {}

  async publish(eventType: string, data: Record<string, any>): Promise<void> {
    await this.eventBus.publish(eventType, data);
  }
}
```

### 7. Express App

**src/payment-service/app.ts:**
```typescript
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createPaymentRoutes } from './routes/payment.routes';
import { PaymentController } from './controllers/payment.controller';
import { errorHandler } from '../shared/middleware/error-handler';

export const createApp = (controller: PaymentController): Express => {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false })); // Allow inline scripts for mock page
  app.use(cors());
  app.use(express.json());

  app.use('/api/v1', createPaymentRoutes(controller));
  app.use('/', createPaymentRoutes(controller)); // For /pay/:paymentId route

  app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'payment-service' });
  });

  app.use(errorHandler);

  return app;
};
```

### 8. Service Entry Point

**src/payment-service/index.ts:**
```typescript
import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { connectDatabase } from '../shared/config/database';
import { createPubSubClients } from '../shared/config/redis';
import { EventBus } from '../shared/events/event-bus';
import { PaymentRepository } from './repositories/payment.repository';
import { MockPaymentService } from './services/mock-payment.service';
import { PaymentController } from './controllers/payment.controller';
import { PaymentPublisher } from './events/publishers/payment.publisher';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('payment-service');
const PORT = process.env.PAYMENT_SERVICE_PORT || 3003;

async function bootstrap() {
  try {
    await connectDatabase();

    const { publisher, subscriber } = createPubSubClients();
    const eventBus = new EventBus(publisher, subscriber);

    // Initialize services
    const paymentRepository = new PaymentRepository();
    const eventPublisher = new PaymentPublisher(eventBus);
    const paymentService = new MockPaymentService(paymentRepository, eventPublisher);

    // Initialize controller
    const controller = new PaymentController(paymentService);

    // Create Express app
    const app = createApp(controller);

    // Start server
    app.listen(PORT, () => {
      logger.info(`Payment Service listening on port ${PORT}`);
      logger.info(`Mock payment page available at http://localhost:${PORT}/pay/{paymentId}`);
    });
  } catch (error) {
    logger.error('Failed to start Payment Service', { error });
    process.exit(1);
  }
}

bootstrap();
```

## Implementation Steps

1. Create payment-service directory structure
2. Implement payment repository
3. Implement mock payment service with configurable behavior
4. Create payment controller with mock payment page
5. Set up routes for API and mock payment UI
6. Implement event publisher for payment events
7. Create Express app
8. Test payment flow end-to-end

## Testing Strategy

### Complete End-to-End Check-In Flow Test:

Now you can test the COMPLETE check-in flow with all services running!

**Step 1: Start All Services**
```bash
# Terminal 1: Seat Service
npm run dev:seat

# Terminal 2: Check-In Service
npm run dev:checkin

# Terminal 3: Weight Service
npm run dev:weight

# Terminal 4: Payment Service
npm run dev:payment
```

**Step 2: Complete Check-In Flow (No Baggage)**
```bash
# 1. Start check-in
CHECKIN=$(curl -X POST http://localhost:3002/api/v1/checkin/start \
  -H "Content-Type: application/json" \
  -d '{
    "passengerId": "P12345",
    "userId": "U12345",
    "bookingId": "BK789"
  }' | jq -r '.checkInId')

echo "Check-in ID: $CHECKIN"

# 2. Complete check-in (no baggage)
curl -X POST http://localhost:3002/api/v1/checkin/complete \
  -H "Content-Type: application/json" \
  -d "{
    \"checkInId\": \"$CHECKIN\",
    \"passengerId\": \"P12345\",
    \"userId\": \"U12345\",
    \"seatId\": \"10A\",
    \"baggage\": { \"count\": 0 }
  }" | jq
```
Expected: Returns COMPLETED with boarding pass

**Step 3: Complete Check-In Flow (With Baggage - May Require Payment)**
```bash
# 1. Start check-in
CHECKIN=$(curl -X POST http://localhost:3002/api/v1/checkin/start \
  -H "Content-Type: application/json" \
  -d '{
    "passengerId": "P67890",
    "userId": "U67890",
    "bookingId": "BK456"
  }' | jq -r '.checkInId')

# 2. Complete check-in with 2 bags
RESPONSE=$(curl -X POST http://localhost:3002/api/v1/checkin/complete \
  -H "Content-Type: application/json" \
  -d "{
    \"checkInId\": \"$CHECKIN\",
    \"passengerId\": \"P67890\",
    \"userId\": \"U67890\",
    \"seatId\": \"11B\",
    \"baggage\": { \"count\": 2 }
  }")

echo $RESPONSE | jq

# 3. If payment required, get payment URL
STATE=$(echo $RESPONSE | jq -r '.state')

if [ "$STATE" = "AWAITING_PAYMENT" ]; then
  PAYMENT_URL=$(echo $RESPONSE | jq -r '.paymentUrl')
  echo "Payment required! Open this URL in browser: $PAYMENT_URL"
  
  # Extract payment ID and confirm via API
  PAYMENT_ID=$(echo $PAYMENT_URL | grep -oP 'pay_[a-f0-9-]+')
  
  echo "Confirming payment..."
  curl -X POST http://localhost:3003/api/v1/payments/$PAYMENT_ID/confirm | jq
  
  echo "Check-in should now be completed automatically (via event)"
  sleep 2
  
  # Verify check-in completed
  # (In production, you'd query check-in status API)
fi
```

**Step 4: Test Payment Page in Browser**
1. Complete check-in with baggage that triggers payment
2. Copy the payment URL from the response
3. Open in browser: `http://localhost:3003/pay/{paymentId}`
4. Click "Confirm Payment" button
5. Verify success message appears
6. Check logs to see payment.confirmed event published
7. Check-In Service should complete the check-in automatically

**Step 5: Test Payment Expiry**
```bash
# 1. Initiate payment
PAYMENT=$(curl -X POST http://localhost:3003/api/v1/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50,
    "passengerId": "P11111",
    "checkInId": "ci_test"
  }' | jq -r '.paymentId')

# 2. Wait for expiry (or manually set PAYMENT_EXPIRY_MINUTES=0 for testing)
# 3. Try to confirm expired payment
curl -X POST http://localhost:3003/api/v1/payments/$PAYMENT/confirm

# Expected: 400 error - PAYMENT_EXPIRED
```

### Verification Checklist:
- [ ] Payment Service starts on port 3003
- [ ] Initiate payment creates record in MongoDB
- [ ] Payment URL is generated correctly
- [ ] Mock payment page renders in browser
- [ ] Confirm payment updates status to COMPLETED
- [ ] payment.confirmed event published to Redis
- [ ] Check-In Service receives event and completes check-in
- [ ] Payment expiry validation works
- [ ] Configurable success rate works (test with 0.5)
- [ ] Payment status API returns correct status

### Complete Flow Verification:
After this task, you can test the COMPLETE check-in flow:
1. ✅ Start check-in → Creates check-in record
2. ✅ Hold seat → Seat Service holds seat
3. ✅ Weigh baggage → Weight Service returns weights
4. ✅ If overweight → Payment Service initiates payment
5. ✅ Confirm payment → Event triggers check-in completion
6. ✅ Boarding pass generated with QR code
7. ✅ Seat confirmed in Seat Service

## Expected Outputs
- Working Payment Service on port 3003
- Payment initiation API
- Payment confirmation API
- Mock payment page for browser testing
- Event publishing to Check-In Service
- Payment expiry validation
- Configurable success/failure rates for testing

## Estimated Complexity
**Medium** - Mock service with event integration and simple HTML page.

## Dependencies
- Task 001 (Project setup)
- Task 002 (Database schemas)
- Task 004 (Check-In Service with payment subscriber)

## Next Tasks
- Task 007: Hold Expiration Job Enhancement (already partially done in Task 003)
- After this task, you have a COMPLETE END-TO-END check-in flow to test!
