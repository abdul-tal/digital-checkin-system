# Task 015: API Documentation with Swagger/OpenAPI

## Objective
Create comprehensive API documentation using OpenAPI 3.0 specification with Swagger UI for all microservices, including request/response examples, authentication details, and error codes.

## Priority
P1 (Should Have) - Essential for frontend integration and external consumers

## Description
Generate OpenAPI specifications for all services, set up Swagger UI for interactive API exploration, and document all endpoints with examples, schemas, and error responses.

## Prerequisites
- Task 001-010 completed (All services implemented)

## Technical Requirements

### 1. Dependencies

Add to package.json:
```json
{
  "dependencies": {
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.0"
  },
  "devDependencies": {
    "@types/swagger-jsdoc": "^6.0.4",
    "@types/swagger-ui-express": "^4.1.6"
  }
}
```

### 2. OpenAPI Configuration

**src/shared/docs/swagger-config.ts:**
```typescript
import swaggerJsdoc from 'swagger-jsdoc';

export const createSwaggerSpec = (serviceName: string, port: number) => {
  const options: swaggerJsdoc.Options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: `SkyHigh Core - ${serviceName}`,
        version: '1.0.0',
        description: `API documentation for ${serviceName}`,
        contact: {
          name: 'SkyHigh Airlines Engineering',
          email: 'api@skyhigh.com',
        },
      },
      servers: [
        {
          url: `http://localhost:${port}/api/v1`,
          description: 'Development server',
        },
        {
          url: 'https://api.skyhigh.com/v1',
          description: 'Production server',
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token from /auth/login endpoint',
          },
        },
        schemas: {
          Error: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: {
                    type: 'string',
                    example: 'SEAT_UNAVAILABLE',
                  },
                  message: {
                    type: 'string',
                    example: 'Seat is no longer available',
                  },
                  details: {
                    type: 'object',
                  },
                },
              },
            },
          },
        },
      },
      security: [{ BearerAuth: [] }],
    },
    apis: ['./src/**/*.routes.ts', './src/**/*.controller.ts'],
  };

  return swaggerJsdoc(options);
};
```

### 3. Swagger Setup Middleware

**src/shared/middleware/swagger.middleware.ts:**
```typescript
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { createSwaggerSpec } from '../docs/swagger-config';

export const setupSwagger = (app: Express, serviceName: string, port: number) => {
  const swaggerSpec = createSwaggerSpec(serviceName, port);

  // Swagger JSON endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: `${serviceName} API Docs`,
    })
  );
};
```

### 4. Document Seat Service APIs

**src/seat-service/routes/seat.routes.ts (with JSDoc annotations):**
```typescript
/**
 * @openapi
 * /flights/{flightId}/seatmap:
 *   get:
 *     summary: Get seat map with availability
 *     description: Retrieve all seats for a flight with their availability status
 *     tags:
 *       - Seats
 *     parameters:
 *       - in: path
 *         name: flightId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Z]{2}[0-9]{1,4}$'
 *           example: SK123
 *         description: Flight identifier
 *     responses:
 *       200:
 *         description: Seat map retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 flightId:
 *                   type: string
 *                   example: SK123
 *                 aircraft:
 *                   type: string
 *                   example: Boeing 737
 *                 totalSeats:
 *                   type: integer
 *                   example: 180
 *                 availableSeats:
 *                   type: integer
 *                   example: 45
 *                 seats:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       seatId:
 *                         type: string
 *                         example: 12A
 *                       row:
 *                         type: integer
 *                         example: 12
 *                       column:
 *                         type: string
 *                         example: A
 *                       state:
 *                         type: string
 *                         enum: [AVAILABLE, UNAVAILABLE]
 *                       type:
 *                         type: string
 *                         enum: [WINDOW, MIDDLE, AISLE]
 *                       price:
 *                         type: number
 *                         format: float
 *                         example: 25.00
 *       404:
 *         description: Flight not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/flights/:flightId/seatmap', controller.getSeatMap);

/**
 * @openapi
 * /seats/hold:
 *   post:
 *     summary: Hold a seat for 120 seconds
 *     description: Reserve a seat temporarily, preventing others from selecting it
 *     tags:
 *       - Seats
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - flightId
 *               - seatId
 *               - passengerId
 *             properties:
 *               flightId:
 *                 type: string
 *                 pattern: '^[A-Z]{2}[0-9]{1,4}$'
 *                 example: SK123
 *               seatId:
 *                 type: string
 *                 pattern: '^[0-9]{1,2}[A-F]$'
 *                 example: 12A
 *               passengerId:
 *                 type: string
 *                 example: P12345
 *     responses:
 *       200:
 *         description: Seat held successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 holdId:
 *                   type: string
 *                   example: hold_abc123
 *                 seatId:
 *                   type: string
 *                   example: 12A
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   example: 2026-02-21T10:02:00Z
 *                 remainingSeconds:
 *                   type: integer
 *                   example: 120
 *       409:
 *         description: Seat unavailable (conflict)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: SEAT_UNAVAILABLE
 *                     message:
 *                       type: string
 *                       example: Seat 12A is no longer available
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ['12B', '12C', '13A']
 */
router.post('/seats/hold', validateHoldRequest, controller.holdSeat);
```

### 5. Update Services to Include Swagger

**Example: Update Seat Service (src/seat-service/index.ts):**
```typescript
import { setupSwagger } from '../shared/middleware/swagger.middleware';

// In bootstrap function, after creating app:
const app = createApp(controller);

// Add Swagger documentation
setupSwagger(app, 'Seat Service', 3001);

// Start server...
```

### 6. Complete API Documentation File

**docs/API.md:**
````markdown
# SkyHigh Core API Documentation

## Base URL
- Development: `http://localhost:3000/api/v1`
- Production: `https://api.skyhigh.com/v1`

## Authentication

All endpoints require JWT authentication via Bearer token:
```
Authorization: Bearer <your-jwt-token>
```

### Get Token
```bash
POST /auth/login
{
  "email": "user@example.com",
  "password": "password"
}
```

## Quick Start

### 1. Complete Check-In Flow

```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass"}' | jq -r '.token')

# Get seat map
curl http://localhost:3000/api/v1/flights/SK123/seatmap \
  -H "Authorization: Bearer $TOKEN"

# Start check-in
CHECKIN_ID=$(curl -X POST http://localhost:3000/api/v1/checkin/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "passengerId": "P12345",
    "userId": "U12345",
    "bookingId": "BK789"
  }' | jq -r '.checkInId')

# Complete check-in
curl -X POST http://localhost:3000/api/v1/checkin/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"checkInId\": \"$CHECKIN_ID\",
    \"passengerId\": \"P12345\",
    \"userId\": \"U12345\",
    \"seatId\": \"10A\",
    \"baggage\": { \"count\": 0 }
  }"
```

## Service Documentation Links

When services are running, access interactive documentation:

- **API Gateway:** http://localhost:3000/api-docs
- **Seat Service:** http://localhost:3001/api-docs
- **Check-In Service:** http://localhost:3002/api-docs
- **Payment Service:** http://localhost:3003/api-docs
- **Waitlist Service:** http://localhost:3004/api-docs
- **Notification Service:** http://localhost:3005/api-docs
- **Weight Service:** http://localhost:3006/api-docs
- **Abuse Detection Service:** http://localhost:3007/api-docs

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| SEAT_UNAVAILABLE | 409 | Seat already held/confirmed by another passenger |
| VALIDATION_ERROR | 400 | Invalid request format or missing fields |
| UNAUTHORIZED | 401 | Missing or invalid authentication token |
| FORBIDDEN | 403 | Insufficient permissions for action |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests, retry after cooldown |
| CHECKIN_NOT_FOUND | 404 | Check-in ID not found |
| PAYMENT_EXPIRED | 400 | Payment link has expired |
| BAGGAGE_TOO_HEAVY | 400 | Baggage exceeds maximum weight (32kg) |
| CANCELLATION_WINDOW_CLOSED | 400 | Cannot cancel within 2 hours of departure |
| ALREADY_ON_WAITLIST | 409 | Passenger already on waitlist for this seat |
| ACCESS_BLOCKED | 403 | Temporarily blocked due to suspicious activity |
| CAPTCHA_REQUIRED | 403 | CAPTCHA verification required |

## Rate Limits

| User Type | Requests/Minute |
|-----------|-----------------|
| Anonymous | 20 |
| Authenticated | 100 |
| Staff | 200 |

## Business Rules

- **Seat Hold Duration:** 120 seconds
- **Waitlist Hold Duration:** 300 seconds (5 minutes)
- **Payment Expiry:** 30 minutes
- **Cancellation Window:** Up to 2 hours before departure
- **Baggage Weight Limit:** 25kg (free)
- **Baggage Max Weight:** 32kg (above this = rejected)
- **Baggage Fees:** 25-28kg = $50, 28-32kg = $100
````

### 7. Postman Collection

**docs/postman-collection.json:**
```json
{
  "info": {
    "name": "SkyHigh Core API",
    "description": "Digital Check-In System API Collection",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000/api/v1"
    },
    {
      "key": "token",
      "value": ""
    }
  ],
  "item": [
    {
      "name": "Authentication",
      "item": [
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"test@example.com\",\n  \"password\": \"password123\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/auth/login",
              "host": ["{{baseUrl}}"],
              "path": ["auth", "login"]
            }
          }
        }
      ]
    },
    {
      "name": "Seat Management",
      "item": [
        {
          "name": "Get Seat Map",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/flights/SK123/seatmap",
              "host": ["{{baseUrl}}"],
              "path": ["flights", "SK123", "seatmap"]
            }
          }
        },
        {
          "name": "Hold Seat",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"flightId\": \"SK123\",\n  \"seatId\": \"12A\",\n  \"passengerId\": \"P12345\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/seats/hold",
              "host": ["{{baseUrl}}"],
              "path": ["seats", "hold"]
            }
          }
        }
      ]
    }
  ]
}
```

### 8. README Documentation

**README.md:**
````markdown
# SkyHigh Core - Digital Check-In System

High-performance backend service for airline digital check-in with conflict-free seat assignment, baggage validation, and waitlist management.

## Features

✅ **Conflict-Free Seat Assignment** - Atomic seat reservations using MongoDB transactions  
✅ **Time-Bound Holds** - 120-second seat holds with automatic expiration  
✅ **Baggage Validation** - Automatic weight check and fee calculation  
✅ **Payment Integration** - Mock payment service for baggage fees  
✅ **Waitlist Management** - Priority-based automatic seat assignment  
✅ **Abuse Detection** - Bot detection and rate limiting  
✅ **High Performance** - Handles 500+ concurrent users (P95 < 1s)  
✅ **Event-Driven Architecture** - Redis pub/sub for inter-service communication

## Architecture

**Microservices:**
- API Gateway (Port 3000) - Authentication, routing, rate limiting
- Seat Service (Port 3001) - Seat lifecycle management
- Check-In Service (Port 3002) - Check-in orchestration
- Payment Service (Port 3003) - Mock payment processing
- Waitlist Service (Port 3004) - Waitlist queue management
- Notification Service (Port 3005) - Multi-channel notifications
- Weight Service (Port 3006) - Mock baggage weighing
- Abuse Detection Service (Port 3007) - Pattern detection

**Infrastructure:**
- MongoDB 7.0+ (with replica set for transactions)
- Redis 7.2+ (cache and pub/sub)
- Prometheus (metrics)
- Grafana (dashboards)

## Quick Start

### Prerequisites
```bash
node -v  # v20.x or higher
docker --version
docker-compose --version
```

### Installation
```bash
# Install dependencies
npm install

# Start infrastructure
docker-compose up -d

# Initialize MongoDB replica set
./scripts/init-mongodb.sh

# Seed test data
npm run seed

# Copy environment file
cp .env.example .env
```

### Start Services
```bash
# Start all services (requires multiple terminals)
npm run dev:gateway   # Terminal 1
npm run dev:seat      # Terminal 2
npm run dev:checkin   # Terminal 3
npm run dev:payment   # Terminal 4
npm run dev:weight    # Terminal 5
npm run dev:waitlist  # Terminal 6
npm run dev:notification # Terminal 7
npm run dev:abuse     # Terminal 8
```

### Verify Setup
```bash
# Check all services health
./scripts/health-check.sh
```

## API Documentation

**Interactive Swagger UI:**
- API Gateway: http://localhost:3000/api-docs
- Individual services: http://localhost:{port}/api-docs

**Quick Test:**
```bash
# Login and get token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get seat map
curl http://localhost:3000/api/v1/flights/SK123/seatmap \
  -H "Authorization: Bearer <your-token>"
```

## Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests with coverage
npm test

# Load tests (requires k6)
./k6/run-all-tests.sh
```

## Monitoring

- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3030 (admin/admin)
- **Redis Commander:** http://localhost:8081

## Development

### Project Structure
```
src/
├── api-gateway/          # API Gateway Service
├── seat-service/         # Seat Management
├── checkin-service/      # Check-In Orchestration
├── payment-service/      # Mock Payment
├── waitlist-service/     # Waitlist Management
├── notification-service/ # Notifications
├── weight-service/       # Mock Weight Service
├── abuse-detection-service/ # Abuse Detection
└── shared/               # Shared utilities
    ├── config/
    ├── errors/
    ├── events/
    ├── middleware/
    ├── models/
    ├── types/
    └── utils/
```

### Key Technologies
- **Runtime:** Node.js 20 LTS
- **Language:** TypeScript 5.3+
- **API Framework:** Express.js 4.x
- **Database:** MongoDB 7.0+ (with Mongoose ODM)
- **Cache:** Redis 7.2+ (with ioredis)
- **Testing:** Jest + Supertest
- **Load Testing:** k6
- **Monitoring:** Prometheus + Grafana

## Contributing

1. Create feature branch
2. Write tests
3. Implement feature
4. Ensure tests pass
5. Submit pull request

## License

Proprietary - SkyHigh Airlines
````

## Implementation Steps

1. Install swagger dependencies
2. Create Swagger configuration
3. Add JSDoc annotations to all routes
4. Set up Swagger UI middleware
5. Create OpenAPI schemas for all models
6. Document all error responses
7. Generate Postman collection
8. Write comprehensive README
9. Create API reference documentation
10. Test all documentation links

## Testing Strategy

### Manual Testing After Completion:

**Test 1: Swagger UI Access**
```bash
# Start services and open Swagger UI
open http://localhost:3000/api-docs
open http://localhost:3001/api-docs
open http://localhost:3002/api-docs
```
Expected: Interactive API documentation loads

**Test 2: Try API from Swagger UI**
1. Open http://localhost:3000/api-docs
2. Click "Authorize" button
3. Enter JWT token from login
4. Try "GET /flights/SK123/seatmap"
5. Verify response matches documentation

**Test 3: OpenAPI JSON Export**
```bash
curl http://localhost:3000/api-docs.json | jq > openapi.json
```
Expected: Valid OpenAPI 3.0 JSON

**Test 4: Postman Collection Import**
1. Open Postman
2. Import docs/postman-collection.json
3. Run "Login" request
4. Run "Get Seat Map" request
5. Verify all requests work

### Verification Checklist:
- [ ] All services expose /api-docs endpoint
- [ ] Swagger UI renders correctly
- [ ] All endpoints documented with examples
- [ ] Request/response schemas defined
- [ ] Error codes documented
- [ ] Authentication flow explained
- [ ] Postman collection works
- [ ] README includes quick start guide
- [ ] Code examples are accurate
- [ ] API documentation is up-to-date

## Expected Outputs
- Interactive Swagger UI for all services
- Complete OpenAPI 3.0 specifications
- Postman collection for API testing
- Comprehensive README with examples
- API reference documentation
- Quick start guide
- Error code reference

## Estimated Complexity
**Medium** - Documentation-heavy but critical for adoption.

## Dependencies
- Task 001-010 (All services implemented)

## Next Tasks
- System is now complete and fully documented!
- Ready for production deployment
