# Task 005: Mock Weight Service Implementation

## Objective
Implement a mock Weight Service that simulates baggage weight measurement with configurable delays and realistic weight distribution for testing purposes.

## Priority
P0 (Must Have) - Required for baggage validation in check-in flow

## Description
Build a standalone mock service that simulates baggage weighing with realistic weight distributions (70% within limit, 20% overweight, 10% severely overweight) and configurable delays to simulate real-world baggage weighing systems.

## Prerequisites
- Task 001 completed (Project setup)
- Task 002 completed (Database schemas)

## Technical Requirements

### 1. Directory Structure

```
src/weight-service/
├── controllers/
│   └── weight.controller.ts
├── services/
│   └── mock-weight.service.ts
├── routes/
│   └── weight.routes.ts
├── app.ts
└── index.ts
```

### 2. Mock Weight Service

**src/weight-service/services/mock-weight.service.ts:**
```typescript
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('mock-weight-service');

export interface WeighBagRequest {
  bagId: string;
}

export interface WeighBagResponse {
  bagId: string;
  weight: number;
  measuredAt: Date;
  unit: 'kg';
}

export class MockWeightService {
  private readonly delay: number;

  constructor() {
    this.delay = parseInt(process.env.MOCK_WEIGHT_DELAY_MS || '500');
  }

  async weighBag(req: WeighBagRequest): Promise<WeighBagResponse> {
    // Simulate measurement delay
    await this.sleep(this.delay);

    // Generate realistic weight
    const weight = this.generateRealisticWeight();

    logger.info('Bag weighed', {
      bagId: req.bagId,
      weight: weight.toFixed(2),
      unit: 'kg',
    });

    return {
      bagId: req.bagId,
      weight: parseFloat(weight.toFixed(1)),
      measuredAt: new Date(),
      unit: 'kg',
    };
  }

  private generateRealisticWeight(): number {
    const rand = Math.random();

    // 70% within limit (15-25kg)
    if (rand < 0.7) {
      return 15 + Math.random() * 10;
    }
    // 20% overweight (25-30kg)
    else if (rand < 0.9) {
      return 25 + Math.random() * 5;
    }
    // 10% severely overweight (30-33kg)
    else {
      return 30 + Math.random() * 3;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // For testing: generate specific weight
  async weighBagWithWeight(bagId: string, weight: number): Promise<WeighBagResponse> {
    await this.sleep(this.delay);

    logger.info('Bag weighed (fixed weight)', { bagId, weight });

    return {
      bagId,
      weight,
      measuredAt: new Date(),
      unit: 'kg',
    };
  }
}
```

### 3. Controller

**src/weight-service/controllers/weight.controller.ts:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { MockWeightService } from '../services/mock-weight.service';
import { ValidationError } from '../../shared/errors/app-error';

export class WeightController {
  constructor(private weightService: MockWeightService) {}

  weighBag = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bagId, weight } = req.body;

      if (!bagId) {
        throw new ValidationError('bagId is required');
      }

      // If weight is provided (for testing), use fixed weight
      const result = weight
        ? await this.weightService.weighBagWithWeight(bagId, weight)
        : await this.weightService.weighBag({ bagId });

      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
```

### 4. Routes

**src/weight-service/routes/weight.routes.ts:**
```typescript
import { Router } from 'express';
import { WeightController } from '../controllers/weight.controller';

export const createWeightRoutes = (controller: WeightController): Router => {
  const router = Router();

  router.post('/baggage/weigh', controller.weighBag);

  return router;
};
```

### 5. Express App

**src/weight-service/app.ts:**
```typescript
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createWeightRoutes } from './routes/weight.routes';
import { WeightController } from './controllers/weight.controller';
import { errorHandler } from '../shared/middleware/error-handler';

export const createApp = (controller: WeightController): Express => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use('/api/v1', createWeightRoutes(controller));

  app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'weight-service' });
  });

  app.use(errorHandler);

  return app;
};
```

### 6. Entry Point

**src/weight-service/index.ts:**
```typescript
import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { MockWeightService } from './services/mock-weight.service';
import { WeightController } from './controllers/weight.controller';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('weight-service');
const PORT = process.env.WEIGHT_SERVICE_PORT || 3006;

async function bootstrap() {
  try {
    // Initialize services
    const weightService = new MockWeightService();
    const controller = new WeightController(weightService);

    // Create Express app
    const app = createApp(controller);

    // Start server
    app.listen(PORT, () => {
      logger.info(`Weight Service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Weight Service', { error });
    process.exit(1);
  }
}

bootstrap();
```

## Implementation Steps

1. Create weight-service directory structure
2. Implement mock weight service with realistic weight generator
3. Add configurable delay simulation
4. Create controller and routes
5. Set up Express app
6. Add testing endpoint with fixed weight option
7. Start service and test

## Testing Strategy

### Manual Testing After Completion:

**Test 1: Weigh Bag (Random Weight)**
```bash
curl -X POST http://localhost:3006/api/v1/baggage/weigh \
  -H "Content-Type: application/json" \
  -d '{
    "bagId": "bag-001"
  }'
```
Expected: Returns weight between 15-33kg

**Test 2: Weigh Bag (Fixed Weight for Testing)**
```bash
curl -X POST http://localhost:3006/api/v1/baggage/weigh \
  -H "Content-Type: application/json" \
  -d '{
    "bagId": "bag-002",
    "weight": 26.5
  }'
```
Expected: Returns exactly 26.5kg

**Test 3: Multiple Bags (Distribution Test)**
Run 100 requests and verify distribution:
```bash
for i in {1..100}; do
  curl -X POST http://localhost:3006/api/v1/baggage/weigh \
    -H "Content-Type: application/json" \
    -d "{\"bagId\":\"bag-$i\"}" -s | jq -r '.weight'
done | awk '{
  if ($1 <= 25) within++
  else if ($1 <= 30) overweight++
  else severe++
}
END {
  print "Within limit: " within "%"
  print "Overweight: " overweight "%"
  print "Severe: " severe "%"
}'
```
Expected: ~70% within, ~20% overweight, ~10% severe

**Test 4: Response Time**
```bash
time curl -X POST http://localhost:3006/api/v1/baggage/weigh \
  -H "Content-Type: application/json" \
  -d '{"bagId":"bag-speed-test"}'
```
Expected: Response time ~500ms (configurable via MOCK_WEIGHT_DELAY_MS)

### Verification Checklist:
- [ ] Weight Service starts on port 3006
- [ ] Weighing returns values between 15-33kg
- [ ] Weight distribution matches target (70/20/10)
- [ ] Fixed weight option works for testing
- [ ] Response time matches configured delay
- [ ] Health endpoint returns OK
- [ ] Service logs weight measurements

## Expected Outputs
- Working Weight Service on port 3006
- Realistic weight generation
- Configurable delay simulation
- Testing mode with fixed weights
- Ready for integration with Check-In Service

## Estimated Complexity
**Low** - Simple mock service with no database dependencies.

## Dependencies
- Task 001 (Project setup)

## Next Tasks
- Task 006: Mock Payment Service
- After Task 006, complete end-to-end check-in flow will be testable!
