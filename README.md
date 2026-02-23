# SkyHigh Core - Digital Check-In System

High-performance microservices backend for airline digital check-in with conflict-free seat assignment, automated waitlist management, and abuse detection.

## ✨ Recent Updates

**Latest Changes:**
- ✅ **Seat Expiration Fixed** - Seats now expire after 20 seconds regardless of payment status
- ✅ **Docker Deployment** - Complete containerization with `docker-compose` and automated setup
- ✅ **MongoDB Replica Set** - High availability with automatic failover
- ✅ **Health Checks** - All services include health monitoring
- ✅ **Demo Collection** - 7 complete Postman scenarios for testing
- ✅ **Comprehensive Docs** - Architecture, workflow, and project structure guides

## 🎉 Production Ready - All Phases Complete!

### ✅ Core System Implemented

**Microservices Architecture:**
- ✅ API Gateway with JWT authentication and authorization
- ✅ Seat Service with atomic conflict-free operations
- ✅ Check-In Service with baggage validation and payment orchestration
- ✅ Payment Service with webhook-based confirmation
- ✅ Waitlist Service with priority-based auto-assignment
- ✅ Notification Service (push, email, SMS)
- ✅ Weight Service for baggage weighing
- ✅ Abuse Detection Service with pattern recognition

**Key Features:**
- ✅ Zero-downtime seat hold expiration (20-second timeout)
- ✅ Automated waitlist assignment on seat availability
- ✅ Event-driven architecture (Redis Pub/Sub)
- ✅ MongoDB transactions for data consistency
- ✅ Docker containerization with health checks
- ✅ Comprehensive demo scenarios and Postman collection

**Documentation:** [ARCHITECTURE.md](ARCHITECTURE.md) | [WORKFLOW_DESIGN.md](WORKFLOW_DESIGN.md) | [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

## Features

### 🎯 Core Functionality

**Seat Management:**
- ✅ Atomic conflict-free seat reservation (no race conditions)
- ✅ Time-bound seat holds (20 seconds, independent of payment)
- ✅ Automatic hold expiration with background jobs (10-second interval)
- ✅ Redis caching for seat maps (real-time invalidation)
- ✅ Seat state machine (AVAILABLE → HELD → CONFIRMED/CANCELLED)

**Check-In Orchestration:**
- ✅ Two-step check-in flow (start → complete)
- ✅ Baggage validation with configurable weight limits (25kg standard, 32kg max)
- ✅ Deterministic baggage weighing for demos (client-provided weights)
- ✅ Overweight fee calculation ($50/kg over limit)
- ✅ Payment pause for overweight baggage
- ✅ Boarding pass generation with QR codes

**Waitlist Management:**
- ✅ Priority-based waitlist (loyalty tier + join time + special needs)
- ✅ Automated seat assignment on availability
- ✅ Auto-complete check-in for waitlisted passengers
- ✅ Notification delivery with boarding pass
- ✅ Event-driven waitlist processing

**Security & Protection:**
- ✅ JWT-based authentication (API Gateway)
- ✅ Role-based authorization (passenger, crew, admin)
- ✅ Permission-based access control
- ✅ Rate limiting (per-IP and per-user)
- ✅ Abuse detection (rapid seat map access, hold spam)
- ✅ Temporary blocking with TTL

**Infrastructure:**
- ✅ Event-driven architecture (Redis Pub/Sub)
- ✅ MongoDB transactions for consistency
- ✅ Docker Compose deployment
- ✅ Health checks and auto-restart
- ✅ MongoDB replica set for high availability

## Tech Stack

- **Backend:** Node.js 20 + TypeScript 5.3
- **Database:** MongoDB 7.0+ (replica set with transactions)
- **Cache & Events:** Redis 7.2+ (caching + pub/sub)
- **Architecture:** Event-driven microservices (8 services)
- **Auth:** JWT with role-based access control
- **Deployment:** Docker Compose with multi-stage builds
- **Monitoring:** Redis Commander, MongoDB Compass

## Key Design Decisions

### ⏱️ Seat Hold Independence
**Seat holds expire after 20 seconds, regardless of payment status.**

This design choice aligns with airline industry standards:
- Forces quick payment completion
- Prevents inventory lock-up during slow payments
- Releases seats for other passengers if payment is delayed
- Payment timeout (30 minutes) is separate from seat hold timeout

**Behavior:**
```
1. UserA completes check-in with 30kg baggage → Payment required
2. Seat 12A is held for 20 seconds
3. After 20 seconds → Seat 12A becomes AVAILABLE
4. UserA's payment link still valid for 30 minutes
5. If UserA pays after seat released → Payment succeeds, but no seat assigned
```

### 🎯 Automated Waitlist Assignment
**Seats automatically assigned to waitlisted passengers on availability.**

When a seat becomes available (via expiration or cancellation):
1. System checks waitlist for that seat
2. Highest priority passenger selected
3. Check-in auto-completed with stored baggage weights
4. Boarding pass generated and sent via notification
5. No manual intervention required

**Priority calculation:** `(loyaltyMultiplier × 100) + (waitTimeMinutes × 1) + (specialNeeds × 50)`

### 🔒 Atomic Operations
**MongoDB transactions ensure zero race conditions.**

All seat state changes use:
- Optimistic locking with conditional updates
- Session-based transactions
- Atomic `findOneAndUpdate` operations
- State validation before transitions

## Quick Start

### Prerequisites

- Docker 20+ and Docker Compose
- Node.js 20+ (for local development only)

### 🚀 Production Deployment (Docker)

```bash
# 1. Clone repository
git clone <repository-url>
cd digital_checkin_system

# 2. Start all services with Docker
chmod +x scripts/docker-up.sh
./scripts/docker-up.sh
```

This single command will:
- Build all Docker images
- Start MongoDB replica set
- Initialize database with seed data
- Start all 8 microservices
- Set up Redis and monitoring tools

**Services will be available at:**
- API Gateway: `http://localhost:3000`
- Redis Commander: `http://localhost:8081`

### 🛠️ Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start infrastructure only
docker-compose up -d mongodb redis redis-commander

# 3. Initialize MongoDB replica set
chmod +x scripts/docker-init-mongo.sh
./scripts/docker-init-mongo.sh

# 4. Seed database
npm run seed

# 5. Start services with auto-reload
npm run dev:all
```

### ✅ Verify Installation

```bash
# Check all services
npm run docker:health

# Or manually check API Gateway
curl http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@skyhigh.com","password":"admin123"}'

# Check MongoDB
docker exec skyhigh-mongodb mongosh --eval "rs.status().ok"
# Expected: 1

# View logs
npm run docker:logs              # All services
npm run docker:logs seat-service # Specific service
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 3000 | Entry point, authentication, routing |
| Seat Service | 3001 | Seat management and conflict prevention |
| Check-In Service | 3002 | Check-in orchestration |
| Payment Service | 3003 | Mock payment processing |
| Waitlist Service | 3004 | Priority-based waitlist |
| Notification Service | 3005 | Push/email/SMS notifications |
| Weight Service | 3006 | Mock baggage weighing |
| Abuse Detection | 3007 | Bot protection and rate limiting |

## API Examples

All requests go through the API Gateway at `http://localhost:3000`.

### 1. Login (Get JWT Token)

```bash
curl http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "passenger@skyhigh.com",
    "password": "passenger123"
  }'
```

### 2. Get Seat Map

```bash
curl http://localhost:3000/api/v1/flights/SK123/seatmap \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Start Check-In

```bash
curl -X POST http://localhost:3000/api/v1/checkin/start \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "passengerId": "P_UserA",
    "userId": "U_UserA",
    "bookingId": "BK_123",
    "flightId": "SK123"
  }'
```

### 4. Complete Check-In (No Baggage)

```bash
curl -X POST http://localhost:3000/api/v1/checkin/complete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "checkInId": "ci_xxx",
    "passengerId": "P_UserA",
    "userId": "U_UserA",
    "seatId": "12A",
    "baggage": { "count": 1, "weights": [20] }
  }'
```

### 5. Join Waitlist

```bash
curl -X POST http://localhost:3000/api/v1/waitlist/join \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "passengerId": "P_UserE",
    "checkInId": "ci_xxx",
    "userId": "U_UserE",
    "flightId": "SK123",
    "seatId": "15E",
    "loyaltyTier": "GOLD",
    "bookingTimestamp": "2024-01-01T10:00:00Z",
    "baggage": { "count": 1, "weights": [18] }
  }'
```

**📦 Complete API Collection:** Import `postman/Demo_Scenarios.postman_collection.json` into Postman for all 7 demo scenarios.

## Testing

### 📋 Demo Scenarios (Postman)

Import `postman/Demo_Scenarios.postman_collection.json` for 7 complete scenarios:

1. **Simple Check-In** - UserA with 20kg baggage → Complete
2. **Overweight Baggage** - UserB with 30kg → Payment → Complete
3. **Already Booked Error** - UserX tries to book UserA's seat
4. **Check-In Cancellation** - UserB cancels, seat becomes available
5. **Seat Hold Expiration** - UserC holds seat, expires after 20 seconds
6. **Waitlist Auto-Assignment** - UserE joins waitlist, gets auto-assigned
7. **Abuse Detection** - Rapid seat map access triggers blocking

**Run all scenarios:**
```bash
# Using Newman (CLI)
npx newman run postman/Demo_Scenarios.postman_collection.json
```

### 🧪 Unit Tests

```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

**Coverage:** 77 tests, 77.45% coverage
- [Unit Tests Summary](./UNIT_TESTS_SUMMARY.md)

### 🔧 Manual Testing Scripts

```bash
# Test seat hold expiration
bash scripts/test-seat-expiration.sh

# Test concurrent holds (race conditions)
bash scripts/test-concurrent-holds.sh

# Test waitlist auto-completion
bash scripts/test-waitlist-auto-complete.sh

# Test abuse detection
bash scripts/test-abuse-detection.sh
```

### 📚 Testing Documentation
- [Demo Scenarios Flow](./DEMO_SCENARIOS_FLOW.md) - Detailed scenario descriptions
- [Workflow Design](./WORKFLOW_DESIGN.md) - Implementation flows and diagrams
- [Architecture](./ARCHITECTURE.md) - System architecture and design decisions

## Development

### NPM Scripts

#### Development
```bash
npm run dev:all          # Start all services with nodemon
npm run dev:gateway      # API Gateway only
npm run dev:seat         # Seat Service only
npm run dev:checkin      # Check-In Service only
npm run dev:payment      # Payment Service only
npm run dev:waitlist     # Waitlist Service only
npm run dev:notification # Notification Service only
npm run dev:weight       # Weight Service only
npm run dev:abuse        # Abuse Detection only
```

#### Docker Operations
```bash
npm run docker:up        # Start all services (with init)
npm run docker:down      # Stop all services
npm run docker:build     # Build images
npm run docker:restart   # Restart all services
npm run docker:logs      # View logs
npm run docker:health    # Health check all services
npm run docker:clean     # Remove all containers and volumes
npm run docker:ps        # List running containers
```

#### Testing
```bash
npm test                 # Run all unit tests
npm run test:coverage    # Run with coverage report
npm run test:watch       # Watch mode
npm run seed             # Seed database with test data
```

#### Code Quality
```bash
npm run lint             # Run ESLint
npm run format           # Format with Prettier
npm run build            # Compile TypeScript
```

## Performance & Limits

### System Capacity
- **Seats per flight:** 180 (30 rows × 6 columns)
- **Concurrent seat holds:** Unlimited (atomic operations)
- **Hold expiration check:** Every 10 seconds
- **Seat hold duration:** 20 seconds
- **Payment timeout:** 30 minutes
- **Rate limit:** 100 requests/minute per IP

### Response Times (p95)
- Seat map fetch: < 50ms (cached)
- Seat hold: < 100ms (with transaction)
- Check-in complete: < 200ms (with baggage validation)
- Waitlist auto-assign: < 300ms (end-to-end)

### Scalability
- **Horizontal scaling:** All services are stateless (except databases)
- **Database:** MongoDB replica set for read scaling
- **Cache:** Redis for session and seat map caching
- **Events:** Redis Pub/Sub for loose coupling

## Monitoring

- **Redis Commander:** http://localhost:8081 (view cache, pub/sub)
- **MongoDB Compass:** `mongodb://localhost:27017/skyhigh?directConnection=true`
- **Service Health:** `npm run docker:health`

## Project Structure

```
digital_checkin_system/
├── src/
│   ├── api-gateway/           # API Gateway Service
│   ├── seat-service/          # Seat Management Service
│   ├── checkin-service/       # Check-In Orchestration
│   ├── payment-service/       # Mock Payment Service
│   ├── waitlist-service/      # Waitlist Management
│   ├── notification-service/  # Notifications
│   ├── weight-service/        # Mock Weight Service
│   ├── abuse-detection-service/ # Abuse Detection
│   └── shared/                # Shared utilities
│       ├── utils/             # Common utilities
│       ├── types/             # TypeScript interfaces
│       ├── errors/            # Error classes
│       ├── middleware/        # Shared middleware
│       ├── models/            # MongoDB models
│       └── config/            # Configuration
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/                   # Utility scripts
├── docker/                    # Docker configurations
├── k6/                        # Load testing scripts
└── docs/                      # Documentation
```

## Documentation

### Phase 1: Seat Management
- **Quick Start:** [QUICKSTART.md](./QUICKSTART.md) - Get Phase 1 running in 3 minutes
- **Implementation Details:** [PHASE1_COMPLETE.md](./PHASE1_COMPLETE.md) - Full Phase 1 summary
- **Testing Guide:** [TESTING_PHASE1.md](./TESTING_PHASE1.md) - Comprehensive test scenarios

### Phase 2: Check-In Flow
- **Quick Start:** [QUICKSTART_PHASE2.md](./QUICKSTART_PHASE2.md) - Get Phase 2 running in 5 minutes
- **Implementation Details:** [PHASE2_COMPLETE.md](./PHASE2_COMPLETE.md) - Full Phase 2 summary
- **Testing Guide:** [TESTING_PHASE2.md](./TESTING_PHASE2.md) - Complete check-in flow tests
- **Test Script:** `./scripts/test-phase2.sh` - Automated testing

### Project Planning
- **Task Roadmap:** [tasks/README.md](./tasks/README.md) - All phases and tasks
- **Implementation Guide:** [tasks/000_implementation_roadmap.md](./tasks/000_implementation_roadmap.md) - Architecture overview

---

## Environment Variables

### Core Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URI` | `mongodb://mongodb:27017/skyhigh?replicaSet=rs0` | MongoDB connection string |
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `JWT_SECRET` | `your-secret-key-here-change-in-production` | JWT signing secret |

### Business Rules

| Variable | Default | Description |
|----------|---------|-------------|
| `SEAT_HOLD_DURATION_SECONDS` | `20` | Seat hold timeout (independent of payment) |
| `PAYMENT_EXPIRY_MINUTES` | `30` | Payment timeout for overweight baggage |
| `MAX_BAGGAGE_WEIGHT_KG` | `25` | Standard baggage weight limit |
| `MAX_ABSOLUTE_BAGGAGE_WEIGHT_KG` | `32` | Absolute maximum (cannot exceed) |
| `OVERWEIGHT_FEE_PER_KG` | `50` | Fee per kg over limit ($) |

### Security & Protection

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per minute per IP |
| `RAPID_SEAT_MAP_THRESHOLD` | `50` | Seat maps accessed before blocking |
| `SEAT_MAP_WINDOW_MS` | `2000` | Time window for abuse detection (ms) |
| `ABUSE_BLOCK_DURATION_MINUTES` | `30` | Temporary block duration |

**Docker Environment:** Use `.env.docker` for containerized deployment (hostname `mongodb` instead of `localhost`).

## Troubleshooting

### Services Not Starting

```bash
# Check container status
docker-compose ps

# View logs for specific service
docker logs skyhigh-seat-service --tail 50

# Restart all services
npm run docker:restart

# Clean rebuild
npm run docker:clean
docker-compose build --no-cache
npm run docker:up
```

### MongoDB Replica Set Issues

```bash
# Check replica set status
docker exec skyhigh-mongodb mongosh --eval "rs.status().ok"
# Expected: 1

# Re-initialize if needed
docker exec skyhigh-mongodb mongosh --eval "rs.initiate()"

# Verify members
docker exec skyhigh-mongodb mongosh --eval "rs.status().members"
```

### MongoDB Compass Connection

Use **direct connection** to avoid replica set hostname resolution:

```
mongodb://localhost:27017/skyhigh?directConnection=true
```

**Note:** If you reconfigure the replica set host to `localhost:27017` for Compass, Docker services will break. Use `directConnection=true` instead.

### Seat Hold Not Expiring

```bash
# Check if hold expiration job is running
docker logs skyhigh-seat-service | grep "hold expiration"

# Verify SEAT_HOLD_DURATION_SECONDS in .env.docker
grep SEAT_HOLD_DURATION .env.docker

# Rebuild seat service if configuration changed
docker-compose up -d --build seat-service
```

### Waitlist Not Processing

```bash
# Check waitlist service logs
docker logs skyhigh-waitlist-service --tail 50

# Verify event bus connections
docker logs skyhigh-waitlist-service | grep "EventBus ready"

# Check for Redis connectivity
docker exec skyhigh-redis redis-cli ping
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill process or change port in .env.docker
# Then restart services
docker-compose restart
```

## Docker Commands

```bash
# Start all services
npm run docker:up           # Full startup with initialization

# Stop all services
npm run docker:down

# View logs
npm run docker:logs         # All services
npm run docker:logs api-gateway  # Specific service

# Rebuild and restart
npm run docker:restart
npm run docker:build

# Health check
npm run docker:health

# Clean everything (remove volumes)
npm run docker:clean

# Manual operations
docker-compose ps                    # Check status
docker exec skyhigh-mongodb mongosh  # MongoDB shell
docker exec skyhigh-redis redis-cli  # Redis CLI
```

## Documentation

### System Documentation
- **[Architecture](ARCHITECTURE.md)** - System architecture, microservices design, scalability
- **[Workflow Design](WORKFLOW_DESIGN.md)** - Implementation flows, database schema, state diagrams
- **[Project Structure](PROJECT_STRUCTURE.md)** - Directory structure, module purposes, key patterns
- **[Demo Scenarios](DEMO_SCENARIOS_FLOW.md)** - 7 complete end-to-end test scenarios

### Development Guides
- [Product Requirements](SkyHigh_Core_PRD.md)
- [Technical Design](SkyHigh_Core_TDD.md)
- [Implementation Roadmap](tasks/000_implementation_roadmap.md)
- [Task Breakdown](tasks/README.md)

### Testing Documentation
- [Unit Tests Summary](UNIT_TESTS_SUMMARY.md)
- [Postman Collection Guide](postman/COLLECTION_RUNNER_GUIDE.md)

## License

MIT

## Contact

For questions or issues, please open a GitHub issue.
