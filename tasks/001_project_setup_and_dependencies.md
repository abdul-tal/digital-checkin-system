# Task 001: Project Setup and Dependencies

## Objective
Set up the foundational project structure for the SkyHigh Core microservices architecture with all required dependencies and development tooling.

## Priority
P0 (Must Have) - Foundation for all other tasks

## Description
Create the monorepo structure for all microservices, initialize Node.js/TypeScript environment, and set up shared utilities, configurations, and development tools.

## Prerequisites
- Node.js 20 LTS installed
- MongoDB 7.0+ available (local or Atlas)
- Redis 7.2+ available (local or Docker)
- Docker and Docker Compose installed

## Technical Requirements

### 1. Project Structure
```
digital_checkin_system/
├── src/
│   ├── api-gateway/           # API Gateway Service
│   ├── seat-service/          # Seat Management Service
│   ├── checkin-service/       # Check-In Orchestration Service
│   ├── payment-service/       # Mock Payment Service
│   ├── waitlist-service/      # Waitlist Management Service
│   ├── notification-service/  # Notification Service
│   ├── weight-service/        # Mock Weight Service
│   ├── abuse-detection-service/ # Abuse Detection Service
│   └── shared/                # Shared utilities
│       ├── utils/             # Common utilities
│       ├── types/             # TypeScript interfaces
│       ├── errors/            # Error classes
│       ├── middleware/        # Shared middleware
│       └── config/            # Configuration
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docker/                    # Docker configurations
├── k6/                        # Load testing scripts
├── docs/                      # Additional documentation
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

### 2. Core Dependencies

**Runtime Dependencies:**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.0",
    "ioredis": "^5.3.2",
    "jsonwebtoken": "^9.0.2",
    "joi": "^17.11.0",
    "winston": "^3.11.0",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.5",
    "rate-limit-redis": "^4.2.0",
    "uuid": "^9.0.1",
    "dotenv": "^16.3.1",
    "prom-client": "^15.1.0",
    "qrcode": "^1.5.3",
    "compression": "^1.7.4"
  }
}
```

**Development Dependencies:**
```json
{
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/cors": "^2.8.17",
    "@types/compression": "^1.7.5",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2",
    "nodemon": "^3.0.2",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.11",
    "ts-jest": "^29.1.1",
    "supertest": "^6.3.3",
    "@types/supertest": "^6.0.2",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0",
    "prettier": "^3.1.1"
  }
}
```

### 3. TypeScript Configuration

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 4. Environment Configuration

**.env.example:**
```bash
# Application
NODE_ENV=development
LOG_LEVEL=info

# MongoDB
MONGODB_URI=mongodb://admin:password@localhost:27017/skyhigh?authSource=admin
MONGODB_MAX_POOL_SIZE=100
MONGODB_MIN_POOL_SIZE=10

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# Service URLs (for inter-service communication)
SEAT_SERVICE_URL=http://localhost:3001
CHECKIN_SERVICE_URL=http://localhost:3002
PAYMENT_SERVICE_URL=http://localhost:3003
WAITLIST_SERVICE_URL=http://localhost:3004
NOTIFICATION_SERVICE_URL=http://localhost:3005
WEIGHT_SERVICE_URL=http://localhost:3006
ABUSE_DETECTION_SERVICE_URL=http://localhost:3007

# Service Ports
API_GATEWAY_PORT=3000
SEAT_SERVICE_PORT=3001
CHECKIN_SERVICE_PORT=3002
PAYMENT_SERVICE_PORT=3003
WAITLIST_SERVICE_PORT=3004
NOTIFICATION_SERVICE_PORT=3005
WEIGHT_SERVICE_PORT=3006
ABUSE_DETECTION_SERVICE_PORT=3007

# Mock Service Configuration
MOCK_PAYMENT_DELAY_MS=1000
MOCK_PAYMENT_SUCCESS_RATE=1.0
MOCK_WEIGHT_DELAY_MS=500

# Business Rules
SEAT_HOLD_DURATION_SECONDS=120
WAITLIST_HOLD_DURATION_SECONDS=300
PAYMENT_EXPIRY_MINUTES=30
CANCELLATION_WINDOW_HOURS=2

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Cache
CACHE_SEATMAP_TTL_SECONDS=5
```

### 5. Docker Compose Setup

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: skyhigh-mongodb
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
      MONGO_INITDB_DATABASE: skyhigh
    volumes:
      - mongodb_data:/data/db
    command: ["--replSet", "rs0"]
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7.2-alpine
    container_name: skyhigh-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: skyhigh-redis-commander
    environment:
      - REDIS_HOSTS=local:redis:6379
    ports:
      - "8081:8081"
    depends_on:
      - redis

volumes:
  mongodb_data:
  redis_data:
```

### 6. Shared Utilities

**src/shared/utils/logger.ts:**
```typescript
import winston from 'winston';

export const createLogger = (serviceName: string) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: {
      service: serviceName,
      environment: process.env.NODE_ENV || 'development',
    },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
    ],
  });
};
```

**src/shared/types/common.types.ts:**
```typescript
export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export enum SeatState {
  AVAILABLE = 'AVAILABLE',
  HELD = 'HELD',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export enum CheckInState {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum SeatType {
  WINDOW = 'WINDOW',
  MIDDLE = 'MIDDLE',
  AISLE = 'AISLE',
}

export enum LoyaltyTier {
  PLATINUM = 'PLATINUM',
  GOLD = 'GOLD',
  SILVER = 'SILVER',
  REGULAR = 'REGULAR',
}
```

**src/shared/errors/app-error.ts:**
```typescript
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class SeatUnavailableError extends AppError {
  constructor(public suggestions: string[] = []) {
    super(409, 'SEAT_UNAVAILABLE', 'Seat is no longer available');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
  }
}
```

## Implementation Steps

### Step 1: Initialize Project
```bash
npm init -y
npm install [dependencies from above]
npm install -D [dev dependencies from above]
```

### Step 2: Create Directory Structure
Create all service directories and shared folder as shown above.

### Step 3: Configure TypeScript
Create tsconfig.json with strict mode enabled.

### Step 4: Set Up Docker Environment
Create docker-compose.yml for MongoDB and Redis.

### Step 5: Create Shared Utilities
- Logger (Winston)
- Error classes
- Common types
- Configuration loader

### Step 6: Initialize MongoDB Replica Set
```bash
docker-compose up -d mongodb
docker exec -it skyhigh-mongodb mongosh --eval "rs.initiate()"
```

### Step 7: Create Scripts in package.json
```json
{
  "scripts": {
    "dev:gateway": "nodemon src/api-gateway/index.ts",
    "dev:seat": "nodemon src/seat-service/index.ts",
    "dev:checkin": "nodemon src/checkin-service/index.ts",
    "dev:payment": "nodemon src/payment-service/index.ts",
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write \"src/**/*.ts\""
  }
}
```

## Testing Strategy

### Manual Testing After Completion:
1. Start MongoDB and Redis: `docker-compose up -d`
2. Verify MongoDB connection: `mongosh mongodb://admin:password@localhost:27017`
3. Verify Redis connection: `redis-cli ping`
4. Build TypeScript: `npm run build`
5. Check no compilation errors

### Verification Checklist:
- [ ] All dependencies installed successfully
- [ ] TypeScript compiles without errors
- [ ] MongoDB container running and accessible
- [ ] Redis container running and accessible
- [ ] Shared utilities export correctly
- [ ] Environment variables load from .env file
- [ ] Logger outputs structured JSON logs
- [ ] Error classes extend properly

## Expected Outputs
- Complete project structure with 8 service folders
- Configured tsconfig.json
- Working docker-compose with MongoDB + Redis
- Shared utilities (logger, errors, types)
- Environment configuration
- Package.json with all dependencies
- README.md with setup instructions

## Estimated Complexity
**Medium** - Setting up infrastructure and dependencies is straightforward but requires attention to detail.

## Dependencies
None - This is the foundation task.

## Next Tasks
- Task 002: Database Setup (MongoDB schemas and indexes)
- Task 003: Seat Service Implementation
