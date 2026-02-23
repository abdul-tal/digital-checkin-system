# Project Structure

## Overview

The SkyHigh Digital Check-In System is a microservices-based application built with Node.js, TypeScript, MongoDB, and Redis. This document explains the structure and purpose of each folder and key module.

---

## Directory Structure

```
digital_checkin_system/
├── src/                          # Source code for all microservices
│   ├── api-gateway/              # API Gateway service
│   ├── seat-service/             # Seat management service
│   ├── checkin-service/          # Check-in orchestration service
│   ├── payment-service/          # Payment processing service
│   ├── waitlist-service/         # Waitlist management service
│   ├── notification-service/     # Notification dispatch service
│   ├── weight-service/           # Baggage weight measurement service
│   ├── abuse-detection-service/  # Anti-abuse & rate limiting service
│   └── shared/                   # Shared utilities and models
├── tests/                        # Test suites
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   └── e2e/                      # End-to-end tests
├── scripts/                      # Utility scripts
├── postman/                      # Postman collection for API testing
├── dist/                         # Compiled JavaScript output
├── docker-compose.yml            # Docker orchestration
├── Dockerfile                    # Multi-stage Docker build
└── tsconfig.json                 # TypeScript configuration
```

---

## Microservices

### 1. API Gateway (`src/api-gateway/`)

**Purpose**: Unified entry point for all client requests, providing authentication, authorization, rate limiting, and request routing.

**Structure**:
```
api-gateway/
├── index.ts                      # Service entry point
├── middleware/
│   ├── authentication.middleware.ts   # JWT validation
│   ├── authorization.middleware.ts    # Role & permission checks
│   ├── rate-limiter.middleware.ts     # Redis-backed rate limiting
│   ├── proxy.middleware.ts            # Request forwarding to services
│   ├── error-handler.middleware.ts    # Centralized error handling
│   └── request-logger.middleware.ts   # HTTP request logging
├── routes/
│   └── auth.routes.ts            # Authentication endpoints
└── services/
    └── auth.service.ts           # JWT token generation
```

**Key Responsibilities**:
- JWT authentication & token generation
- Role-based access control (RBAC)
- Permission-based authorization
- Redis-backed rate limiting (100 req/min per user)
- Request proxying to downstream services
- Centralized error handling & logging
- CORS & security headers (Helmet)

---

### 2. Seat Service (`src/seat-service/`)

**Purpose**: Manages seat inventory, state transitions, and concurrency control for seat operations.

**Structure**:
```
seat-service/
├── index.ts                      # Service entry point
├── controllers/
│   └── seat.controller.ts        # HTTP request handlers
├── services/
│   ├── seat-hold.service.ts      # Seat hold/release/confirm logic
│   └── seatmap.service.ts        # Seat map retrieval & caching
├── repositories/
│   └── seat.repository.ts        # MongoDB data access layer
├── jobs/
│   └── hold-expiration.job.ts    # Background job for expired holds
├── events/
│   ├── publishers/
│   │   └── seat.publisher.ts     # Publish seat events
│   └── subscribers/
│       └── checkin.subscriber.ts # Listen to check-in events
└── routes/
    └── seat.routes.ts            # API route definitions
```

**Key Responsibilities**:
- Seat inventory management (180 seats per flight)
- Atomic seat operations using MongoDB transactions
- State machine: `AVAILABLE → HELD → CONFIRMED` or `CANCELLED`
- Hold expiration with automatic release (configurable duration)
- Prevention of premature release for `AWAITING_PAYMENT` check-ins
- Redis caching for seat maps (30s TTL)
- Event publishing for state changes

**State Transitions**:
```
AVAILABLE ──hold──> HELD ──confirm──> CONFIRMED
    ↑                 │
    └─────release─────┘
    ↑
    └─────cancel──────┘
```

---

### 3. Check-In Service (`src/checkin-service/`)

**Purpose**: Orchestrates the check-in workflow, coordinating between seat, baggage, and payment services.

**Structure**:
```
checkin-service/
├── index.ts                      # Service entry point
├── controllers/
│   └── checkin.controller.ts     # HTTP request handlers
├── services/
│   ├── checkin-orchestrator.service.ts  # Main workflow orchestration
│   ├── baggage-validator.service.ts     # Baggage validation & fees
│   └── boardingpass-generator.service.ts # Boarding pass generation
├── clients/
│   ├── seat-service.client.ts    # Seat service HTTP client
│   ├── payment-service.client.ts # Payment service HTTP client
│   └── weight-service.client.ts  # Weight service HTTP client
├── repositories/
│   └── checkin.repository.ts     # MongoDB data access layer
├── events/
│   ├── publishers/
│   │   └── checkin.publisher.ts  # Publish check-in events
│   └── subscribers/
│       └── payment.subscriber.ts # Listen to payment events
└── routes/
    └── checkin.routes.ts         # API route definitions
```

**Key Responsibilities**:
- Check-in workflow orchestration
- Integration with Seat Service for seat operations
- Integration with Weight Service for baggage weighing
- Baggage validation against weight limits (25kg standard, 32kg max)
- Automatic fee calculation for overweight baggage ($100 per bag)
- Payment initiation and tracking
- Boarding pass generation with QR codes
- Check-in state management: `IN_PROGRESS → AWAITING_PAYMENT → COMPLETED`

**Workflow States**:
```
IN_PROGRESS ──baggage OK──> COMPLETED
     │
     └──baggage overweight──> AWAITING_PAYMENT ──payment confirmed──> COMPLETED
```

---

### 4. Payment Service (`src/payment-service/`)

**Purpose**: Simulates payment processing and webhooks for baggage fees.

**Structure**:
```
payment-service/
├── index.ts                      # Service entry point
├── controllers/
│   └── payment.controller.ts     # HTTP request handlers
├── services/
│   └── mock-payment.service.ts   # Simulated payment processing
├── repositories/
│   └── payment.repository.ts     # MongoDB data access layer
├── events/
│   └── publishers/
│       └── payment.publisher.ts  # Publish payment events
└── routes/
    └── payment.routes.ts         # API route definitions
```

**Key Responsibilities**:
- Payment intent creation
- Simulated payment confirmation (configurable delay & success rate)
- Payment state tracking: `PENDING → COMPLETED` or `FAILED`
- Event publishing for payment confirmations
- Webhook simulation for payment updates

---

### 5. Waitlist Service (`src/waitlist-service/`)

**Purpose**: Manages passenger waitlists with priority-based seat assignment.

**Structure**:
```
waitlist-service/
├── index.ts                      # Service entry point
├── controllers/
│   └── waitlist.controller.ts    # HTTP request handlers
├── services/
│   ├── waitlist-manager.service.ts    # Waitlist operations
│   └── priority-calculator.service.ts # Priority scoring algorithm
├── clients/
│   ├── checkin-service.client.ts      # Check-in service HTTP client
│   └── notification-service.client.ts # Notification service HTTP client
├── repositories/
│   └── waitlist.repository.ts    # MongoDB data access layer
├── events/
│   ├── publishers/
│   │   └── waitlist.publisher.ts # Publish waitlist events
│   └── subscribers/
│       └── seat.subscriber.ts    # Listen to seat availability events
└── routes/
    └── waitlist.routes.ts        # API route definitions
```

**Key Responsibilities**:
- Waitlist entry management
- Priority-based ranking (loyalty tier, booking time, special needs)
- Automatic seat assignment when available
- Automated check-in completion for waitlisted passengers
- Integration with Notification Service for passenger alerts
- Event-driven seat availability processing

**Priority Factors**:
- Loyalty tier (GOLD: 100, SILVER: 50, BRONZE: 20)
- Booking timestamp (earlier = higher priority)
- Special needs (+50 bonus)

---

### 6. Notification Service (`src/notification-service/`)

**Purpose**: Dispatches notifications via push, email, and SMS channels.

**Structure**:
```
notification-service/
├── index.ts                      # Service entry point
├── controllers/
│   └── notification.controller.ts # HTTP request handlers
├── services/
│   ├── notification-dispatcher.service.ts # Notification orchestration
│   ├── mock-push.service.ts      # Mock push notification service
│   ├── mock-email.service.ts     # Mock email service
│   └── mock-sms.service.ts       # Mock SMS service
├── events/
│   └── subscribers/
│       └── waitlist.subscriber.ts # Listen to waitlist events
├── templates/
│   └── notification-templates.ts # Notification message templates
└── routes/
    └── notification.routes.ts    # API route definitions
```

**Key Responsibilities**:
- Multi-channel notification dispatch (push, email, SMS)
- Template-based message formatting
- Event-driven notifications for waitlist assignments
- Simulated delivery with configurable delays

**Notification Types**:
- `WAITLIST_ASSIGNED`: Seat assigned from waitlist
- `WAITLIST_CHECKIN_COMPLETED`: Check-in auto-completed for waitlisted passenger
- `PAYMENT_REQUIRED`: Baggage fee payment needed
- `CHECK_IN_COMPLETED`: Check-in successful

---

### 7. Weight Service (`src/weight-service/`)

**Purpose**: Simulates baggage weighing operations.

**Structure**:
```
weight-service/
├── index.ts                      # Service entry point
├── controllers/
│   └── weight.controller.ts      # HTTP request handlers
├── services/
│   └── mock-weight.service.ts    # Simulated weight measurement
└── routes/
    └── weight.routes.ts          # API route definitions
```

**Key Responsibilities**:
- Simulated baggage weight measurement (15-35kg random range)
- Configurable delay to simulate physical weighing
- Support for deterministic weights (for testing)

---

### 8. Abuse Detection Service (`src/abuse-detection-service/`)

**Purpose**: Detects and blocks abusive access patterns.

**Structure**:
```
abuse-detection-service/
├── index.ts                      # Service entry point
├── controllers/
│   └── abuse.controller.ts       # HTTP request handlers
├── services/
│   └── pattern-detector.service.ts # Abuse pattern detection
├── repositories/
│   └── audit.repository.ts       # MongoDB audit logging
└── routes/
    └── abuse.routes.ts           # API route definitions
```

**Key Responsibilities**:
- Rapid access pattern detection (50 seat maps in 2 seconds)
- Hold spam pattern detection (10 holds in 30 seconds)
- Redis-backed temporary blocking with TTL
- CAPTCHA requirement for blocked users
- MongoDB audit trail for investigations

**Detection Patterns**:
- Rapid seat map access: >50 requests in 2 seconds → 5 min block
- Hold spam: >10 holds in 30 seconds → 10 min block

---

## Shared Modules (`src/shared/`)

### Structure
```
shared/
├── config/
│   └── database.ts               # MongoDB connection config
├── models/
│   ├── seat.model.ts             # Seat document schema
│   ├── checkin.model.ts          # Check-in document schema
│   ├── payment.model.ts          # Payment document schema
│   ├── waitlist.model.ts         # Waitlist document schema
│   └── audit.model.ts            # Audit log schema
├── events/
│   └── event-bus.ts              # Redis Pub/Sub wrapper
├── errors/
│   └── app-error.ts              # Custom error class
├── types/
│   └── common.types.ts           # Shared TypeScript types
└── utils/
    └── logger.ts                 # Winston logger configuration
```

### Purpose

**Config**:
- Centralized MongoDB connection with replica set support
- Environment variable management
- Connection pooling configuration

**Models**:
- Mongoose schemas for all domain entities
- Indexes for query optimization
- Validation rules and constraints
- Unified state history tracking

**Events**:
- Redis Pub/Sub abstraction with connection management
- Event publishing and subscription patterns
- Automatic reconnection handling
- Type-safe event payloads

**Errors**:
- Standardized error format across services
- HTTP status code mapping
- Error code enumeration

**Types**:
- Shared TypeScript interfaces and enums
- Service client request/response types
- Domain model types

**Utils**:
- Winston logger with structured logging
- Log levels by environment (debug in dev, info in prod)
- Request ID tracking for distributed tracing

---

## Tests (`tests/`)

### Structure
```
tests/
├── unit/                         # Isolated unit tests
│   ├── api-gateway/              # Gateway middleware tests
│   ├── seat-service/             # Seat service logic tests
│   ├── checkin-service/          # Check-in orchestration tests
│   └── waitlist-service/         # Waitlist priority tests
├── integration/                  # Service integration tests
│   └── checkin-flow.test.ts      # End-to-end check-in flow
└── e2e/                          # Full system tests
    └── demo-scenarios.test.ts    # Demo scenario validation
```

**Test Coverage**:
- Unit tests: 340+ tests across 33 suites
- Integration tests: Check-in workflow validation
- E2E tests: Full system demo scenarios

**Testing Tools**:
- Jest for test execution
- Supertest for HTTP testing
- MongoDB Memory Server for isolated DB tests
- ioredis-mock for Redis testing

---

## Scripts (`scripts/`)

### Key Scripts

**Development**:
- `seed-data.ts`: Seeds MongoDB with initial data (180 seats)
- `test-redis-pubsub.ts`: Tests Redis Pub/Sub connectivity

**Docker**:
- `docker-up.sh`: Full system startup with initialization
- `docker-init-mongo.sh`: MongoDB replica set initialization
- `docker-logs.sh`: View service logs
- `docker-health.sh`: Health check for all services
- `init-replica-set.sh`: MongoDB replica set configuration

**Testing**:
- `test-phase4.sh`: Phase 4 feature testing
- `test-waitlist-auto-complete.sh`: Waitlist automation testing
- `check-services.sh`: Service status verification

---

## Configuration Files

### TypeScript Configuration

**`tsconfig.json`**: Main TypeScript configuration
- Target: ES2022
- Module: CommonJS
- Strict mode enabled
- Source maps for debugging
- Output to `dist/` directory

**`tsconfig.build.json`**: Docker build configuration
- Excludes scripts and tests
- Optimized for production builds
- Separate rootDir for clean output structure

### Docker Configuration

**`Dockerfile`**: Multi-stage build
- Stage 1 (builder): Compile TypeScript
- Stage 2 (runtime): Production dependencies only
- Non-root user for security
- Optimized layer caching

**`docker-compose.yml`**: Service orchestration
- 11 containers (8 services + 3 infrastructure)
- Health checks for dependencies
- Custom network for service communication
- Volume persistence for MongoDB and Redis
- Environment variable injection

**`.dockerignore`**: Build optimization
- Excludes node_modules, tests, docs
- Reduces image size and build time

**`.env.docker`**: Docker environment variables
- Service URLs with container names
- MongoDB replica set configuration
- Redis connection settings
- Business rule parameters

### Package Configuration

**`package.json`**: NPM scripts and dependencies
- Development scripts with nodemon
- Docker management scripts
- Test execution scripts
- Build and deployment scripts

**Key Dependencies**:
- `express`: Web framework
- `mongoose`: MongoDB ODM
- `ioredis`: Redis client
- `axios`: HTTP client
- `jsonwebtoken`: JWT authentication
- `winston`: Logging
- `helmet`: Security headers
- `express-rate-limit`: Rate limiting

---

## Key Design Patterns

### 1. Microservices Architecture
- Independent deployment and scaling
- Service isolation with dedicated databases
- Inter-service communication via HTTP + Redis Pub/Sub

### 2. Repository Pattern
- Data access abstraction
- Centralized query logic
- Easy testing with mocks

### 3. Service Layer Pattern
- Business logic encapsulation
- Orchestration of repositories and clients
- Reusable service components

### 4. Event-Driven Architecture
- Loose coupling between services
- Asynchronous processing
- Eventual consistency

### 5. Client Pattern
- HTTP client abstraction for service-to-service calls
- Retry logic and timeout handling
- Type-safe request/response

### 6. Middleware Pattern
- Request processing pipeline
- Cross-cutting concerns (auth, logging, errors)
- Composable and reusable

---

## Environment Variables

### Required Variables

**MongoDB**:
- `MONGODB_URI`: Connection string with replica set
- `MONGODB_MAX_POOL_SIZE`: Connection pool size
- `MONGODB_MIN_POOL_SIZE`: Minimum pool size

**Redis**:
- `REDIS_HOST`: Redis server hostname
- `REDIS_PORT`: Redis server port
- `REDIS_PASSWORD`: Authentication password

**JWT**:
- `JWT_SECRET`: Token signing secret
- `JWT_EXPIRES_IN`: Token expiration duration

**Service URLs**:
- `SEAT_SERVICE_URL`: Seat service endpoint
- `CHECKIN_SERVICE_URL`: Check-in service endpoint
- `PAYMENT_SERVICE_URL`: Payment service endpoint
- `WAITLIST_SERVICE_URL`: Waitlist service endpoint
- `NOTIFICATION_SERVICE_URL`: Notification service endpoint
- `WEIGHT_SERVICE_URL`: Weight service endpoint
- `ABUSE_DETECTION_SERVICE_URL`: Abuse detection endpoint

**Business Rules**:
- `SEAT_HOLD_DURATION_SECONDS`: Seat hold expiry time (default: 20s)
- `PAYMENT_EXPIRY_MINUTES`: Payment window (default: 30 min)
- `BAGGAGE_WEIGHT_LIMIT`: Standard baggage limit (default: 25kg)
- `BAGGAGE_MAX_WEIGHT`: Absolute maximum (default: 32kg)

---

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start infrastructure
docker-compose up -d mongodb redis redis-commander

# Run individual services
npm run dev:gateway     # API Gateway
npm run dev:seat        # Seat Service
npm run dev:checkin     # Check-in Service
# ... other services

# Seed database
npm run seed
```

### Docker Development
```bash
# Start entire system
npm run docker:up

# View logs
npm run docker:logs [service-name]

# Check health
npm run docker:health

# Stop system
npm run docker:down
```

### Testing
```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# With coverage
npm run test:coverage
```

---

## Port Allocation

| Service | Port | Purpose |
|---------|------|---------|
| API Gateway | 3000 | Main API entry point |
| Seat Service | 3001 | Seat management |
| Check-In Service | 3002 | Check-in workflow |
| Payment Service | 3003 | Payment processing |
| Waitlist Service | 3004 | Waitlist management |
| Notification Service | 3005 | Notifications |
| Weight Service | 3006 | Baggage weighing |
| Abuse Detection Service | 3007 | Abuse detection |
| MongoDB | 27017 | Database |
| Redis | 6379 | Cache & Pub/Sub |
| Redis Commander | 8081 | Redis GUI |

---

## Logging and Monitoring

### Winston Logger Configuration
- Structured JSON logging in production
- Colorized console logs in development
- Log levels: error, warn, info, debug
- Automatic request ID tracking
- Service name identification

### Log Locations
- Console output (stdout/stderr)
- Docker logs accessible via `docker logs`
- Centralized viewing via `npm run docker:logs`

### Health Endpoints
- All services expose `/health` endpoint
- Returns service name and status
- Used by Docker health checks
- Accessible via API Gateway

---

## Security Considerations

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Permission-based authorization
- Token expiration and renewal

### Rate Limiting
- Redis-backed rate limiting
- 100 requests per minute per user
- Sliding window algorithm
- Abuse detection with automatic blocking

### Data Protection
- MongoDB replica set for durability
- Transaction support for consistency
- Atomic operations for concurrency
- No sensitive data in logs

### Docker Security
- Non-root user in containers
- Minimal base images (Alpine)
- No hardcoded secrets
- Environment variable injection

---

## Scalability Considerations

### Horizontal Scaling
- Stateless services (except databases)
- Load balancer compatible
- Shared state in Redis/MongoDB
- Service discovery ready

### Caching Strategy
- Redis caching for seat maps (30s TTL)
- Cache invalidation on state changes
- Reduced database load

### Database Optimization
- Compound indexes for queries
- Connection pooling
- Replica set for read scaling
- Sharding ready (future enhancement)

### Event-Driven Asynchrony
- Non-blocking operations
- Background job processing
- Eventual consistency acceptable

---

## Future Enhancements

### Planned Features
1. **API Versioning**: Support multiple API versions
2. **GraphQL Gateway**: Alternative to REST
3. **Service Mesh**: Istio/Linkerd integration
4. **Observability**: Prometheus + Grafana
5. **Distributed Tracing**: Jaeger/Zipkin
6. **Message Queue**: RabbitMQ/Kafka for events
7. **Database Sharding**: Horizontal database scaling
8. **Multi-Tenancy**: Support multiple airlines
9. **Real-Time Updates**: WebSocket support
10. **Mobile SDK**: Native mobile integration

### Technical Debt
- Add comprehensive E2E tests
- Implement circuit breakers
- Add request retry logic
- Enhance error recovery
- Add performance benchmarks

---

This structure provides a scalable, maintainable foundation for a production-grade airline check-in system while maintaining clear separation of concerns and enabling independent service development and deployment.
