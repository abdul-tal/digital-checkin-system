# System Architecture

## Overview

The SkyHigh Digital Check-In System is built using a **microservices architecture** with event-driven communication, providing a scalable, maintainable, and resilient platform for airline check-in operations.

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Microservices Architecture](#microservices-architecture)
3. [Technology Stack](#technology-stack)
4. [Communication Patterns](#communication-patterns)
5. [Data Architecture](#data-architecture)
6. [Security Architecture](#security-architecture)
7. [Deployment Architecture](#deployment-architecture)
8. [Scalability & Performance](#scalability--performance)
9. [Resilience & Reliability](#resilience--reliability)
10. [Monitoring & Observability](#monitoring--observability)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                  │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐            │
│  │  Web Client  │    │ Mobile App   │    │  Kiosk App   │            │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘            │
│         │                   │                    │                     │
│         └───────────────────┴────────────────────┘                     │
│                             │                                          │
└─────────────────────────────┼──────────────────────────────────────────┘
                              │
                              │ HTTPS
                              │
┌─────────────────────────────▼──────────────────────────────────────────┐
│                      API GATEWAY LAYER                                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                     API Gateway (Port 3000)                     │  │
│  │                                                                 │  │
│  │  • Authentication (JWT)                                         │  │
│  │  • Authorization (RBAC + Permissions)                           │  │
│  │  • Rate Limiting (Redis)                                        │  │
│  │  • Request Routing                                              │  │
│  │  • Error Handling                                               │  │
│  │  • Logging & Monitoring                                         │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│  Seat Service  │    │ CheckIn Service│    │Payment Service │
│   (Port 3001)  │    │   (Port 3002)  │    │  (Port 3003)   │
└───────┬────────┘    └───────┬────────┘    └───────┬────────┘
        │                     │                     │
        │                     │                     │
        ▼                     ▼                     ▼
┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│Waitlist Service│    │Notify  Service │    │Weight  Service │
│   (Port 3004)  │    │   (Port 3005)  │    │  (Port 3006)   │
└───────┬────────┘    └────────────────┘    └────────────────┘
        │
        ▼
┌────────────────┐
│ Abuse Detection│
│ Service (3007) │
└────────────────┘

        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌────────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  MongoDB (27017)   │  │ Redis (6379)    │  │ Redis Commander │
│                    │  │                 │  │    (8081)       │
│ • Replica Set      │  │ • Cache         │  │                 │
│ • Transactions     │  │ • Pub/Sub       │  │ • Web UI        │
│ • Persistence      │  │ • Rate Limiting │  │                 │
└────────────────────┘  └─────────────────┘  └─────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      INFRASTRUCTURE LAYER                               │
│                                                                         │
│  Docker Network (skyhigh-network)                                      │
│  • Service Discovery via DNS                                           │
│  • Inter-service Communication                                         │
│  • Isolated Network Namespace                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Microservices Architecture

### Architecture Principles

1. **Single Responsibility**: Each service owns one business capability
2. **Loose Coupling**: Services communicate via well-defined APIs
3. **High Cohesion**: Related functionality grouped together
4. **Independent Deployment**: Services can be deployed independently
5. **Technology Agnostic**: Each service can use optimal technology
6. **Decentralized Data**: Each service owns its data
7. **Designed for Failure**: Graceful degradation and fault tolerance

---

### Service Breakdown

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Service Domains                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────┐         ┌───────────────────┐              │
│  │  GATEWAY DOMAIN   │         │ INVENTORY DOMAIN  │              │
│  │                   │         │                   │              │
│  │ • API Gateway     │         │ • Seat Service    │              │
│  │                   │         │                   │              │
│  └───────────────────┘         └───────────────────┘              │
│                                                                     │
│  ┌───────────────────┐         ┌───────────────────┐              │
│  │ WORKFLOW DOMAIN   │         │ PAYMENT DOMAIN    │              │
│  │                   │         │                   │              │
│  │ • Check-In Svc    │         │ • Payment Service │              │
│  │                   │         │                   │              │
│  └───────────────────┘         └───────────────────┘              │
│                                                                     │
│  ┌───────────────────┐         ┌───────────────────┐              │
│  │ WAITLIST DOMAIN   │         │NOTIFICATION DOMAIN│              │
│  │                   │         │                   │              │
│  │ • Waitlist Service│         │ • Notify Service  │              │
│  │                   │         │                   │              │
│  └───────────────────┘         └───────────────────┘              │
│                                                                     │
│  ┌───────────────────┐         ┌───────────────────┐              │
│  │ MEASUREMENT DOMAIN│         │ SECURITY DOMAIN   │              │
│  │                   │         │                   │              │
│  │ • Weight Service  │         │ • Abuse Detection │              │
│  │                   │         │                   │              │
│  └───────────────────┘         └───────────────────┘              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Service Interaction Matrix

| Service | Seat | CheckIn | Payment | Waitlist | Notify | Weight | Abuse |
|---------|------|---------|---------|----------|--------|--------|-------|
| **Seat** | - | ✓ Sync | - | - | - | - | - |
| **CheckIn** | ✓ Sync | - | ✓ Sync | - | - | ✓ Sync | - |
| **Payment** | - | ✓ Event | - | - | - | - | - |
| **Waitlist** | ✓ Event | ✓ Sync | - | - | ✓ Sync | - | - |
| **Notify** | - | - | - | ✓ Event | - | - | - |
| **Weight** | - | ✓ Sync | - | - | - | - | - |
| **Abuse** | - | - | - | - | - | - | - |

**Legend**:
- ✓ Sync: Synchronous HTTP communication
- ✓ Event: Asynchronous event-driven communication

---

## Technology Stack

### Backend Services

```
┌─────────────────────────────────────────────────────────────────┐
│  Runtime & Framework                                            │
├─────────────────────────────────────────────────────────────────┤
│  • Node.js 20 (LTS)           - JavaScript runtime             │
│  • TypeScript 5.x             - Type-safe development          │
│  • Express.js 4.x             - Web application framework      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Database & Caching                                             │
├─────────────────────────────────────────────────────────────────┤
│  • MongoDB 7.0                - Document database              │
│  • Mongoose 8.x               - MongoDB ODM                    │
│  • Redis 7.2                  - In-memory data store           │
│  • ioredis 5.x                - Redis client                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Communication & Integration                                    │
├─────────────────────────────────────────────────────────────────┤
│  • Axios 1.x                  - HTTP client                    │
│  • Redis Pub/Sub              - Event messaging                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Security & Authentication                                      │
├─────────────────────────────────────────────────────────────────┤
│  • jsonwebtoken 9.x           - JWT implementation             │
│  • helmet 7.x                 - Security headers               │
│  • express-rate-limit 7.x     - Rate limiting middleware       │
│  • rate-limit-redis 4.x       - Redis rate limit store         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Logging & Monitoring                                           │
├─────────────────────────────────────────────────────────────────┤
│  • Winston 3.x                - Structured logging             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Testing                                                        │
├─────────────────────────────────────────────────────────────────┤
│  • Jest 29.x                  - Testing framework              │
│  • Supertest 6.x              - HTTP testing                   │
│  • @shelf/jest-mongodb        - MongoDB memory server          │
│  • ioredis-mock               - Redis mocking                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Development Tools                                              │
├─────────────────────────────────────────────────────────────────┤
│  • ts-node                    - TypeScript execution           │
│  • nodemon                    - Auto-reload dev server         │
│  • ESLint                     - Code linting                   │
│  • Prettier                   - Code formatting                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Containerization & Orchestration                               │
├─────────────────────────────────────────────────────────────────┤
│  • Docker 24.x                - Containerization               │
│  • Docker Compose 2.x         - Multi-container orchestration  │
│  • Alpine Linux               - Minimal base images            │
└─────────────────────────────────────────────────────────────────┘
```

---

### Technology Choices Rationale

**Node.js + TypeScript**:
- Excellent for I/O-bound operations (API calls, database queries)
- Large ecosystem of packages
- Type safety with TypeScript reduces runtime errors
- Easy to hire developers

**MongoDB**:
- Flexible schema for evolving domain models
- Native JSON support matches JavaScript objects
- Replica set for high availability
- Transactions for consistency
- Excellent for document-oriented data

**Redis**:
- Sub-millisecond latency for caching
- Pub/Sub for event-driven architecture
- Built-in data structures (sets, sorted sets) for rate limiting
- Persistence options for durability

**Express.js**:
- Mature, battle-tested framework
- Large middleware ecosystem
- Simple and unopinionated
- Easy to learn and use

---

## Communication Patterns

### 1. Synchronous HTTP Communication

```
┌──────────────┐                           ┌──────────────┐
│              │                           │              │
│  Check-In    │    HTTP POST /hold        │  Seat        │
│  Service     ├──────────────────────────>│  Service     │
│              │                           │              │
│              │    {seatId, passengerId}  │              │
│              │                           │              │
│              │◄──────────────────────────┤              │
│              │    {state: "HELD"}        │              │
│              │                           │              │
└──────────────┘                           └──────────────┘
```

**Use Cases**:
- Real-time operations requiring immediate response
- Seat holds, confirmations, releases
- Baggage weighing
- Payment initiation
- Waitlist operations

**Characteristics**:
- Request-Response pattern
- Blocking operation
- Strong consistency
- Error propagation
- Circuit breaker patterns for resilience

---

### 2. Asynchronous Event-Driven Communication

```
┌──────────────┐           ┌──────────────┐           ┌──────────────┐
│              │           │              │           │              │
│  Payment     │  PUBLISH  │    Redis     │ SUBSCRIBE │  Check-In    │
│  Service     ├──────────>│   Pub/Sub    ├──────────>│  Service     │
│              │           │              │           │              │
│              │  payment. │              │           │              │
│              │  confirmed│              │           │              │
│              │           │              │           │              │
└──────────────┘           └──────────────┘           └──────────────┘
```

**Use Cases**:
- Non-blocking operations
- Payment confirmations → Check-in completion
- Seat availability → Waitlist processing
- Check-in completion → Notification delivery
- Audit logging

**Characteristics**:
- Publisher-Subscriber pattern
- Non-blocking operation
- Eventual consistency
- Loose coupling
- Horizontal scalability

**Event Channels**:
```javascript
// Event Format
{
  channel: "payment.confirmed",
  payload: {
    paymentId: "pay_xyz789",
    checkInId: "ci_abc123",
    amount: 100,
    timestamp: "2026-02-22T10:18:30Z"
  }
}

// Channels
- seat.confirmed
- seat.released
- seat.hold.expired
- payment.confirmed
- payment.failed
- waitlist.assigned
- waitlist.checkin.completed
- checkin.completed
- checkin.cancelled
```

---

### 3. Caching Strategy

```
┌──────────────┐           ┌──────────────┐           ┌──────────────┐
│              │           │              │           │              │
│  API Gateway │  1. Check │    Redis     │ 3. Miss   │  Seat        │
│              ├──────────>│    Cache     │◄──────────┤  Service     │
│              │           │              │           │              │
│              │           │  TTL: 30s    │           │              │
│              │◄──────────┤              │           │              │
│              │  2. Hit   │              │           │              │
│              │           │              │           │              │
│              │           │              │  4. Store │              │
│              │           │◄──────────────────────────│              │
│              │           │              │           │              │
└──────────────┘           └──────────────┘           └──────────────┘
```

**Cache Strategy**:
1. **Cache-Aside Pattern**: Application manages cache
2. **TTL**: 30 seconds for seat maps
3. **Invalidation**: On state changes (hold, confirm, release)
4. **Key Format**: `seatmap:{flightId}`

**Benefits**:
- Reduces database load
- Faster response times
- Better scalability
- Lower latency

---

## Data Architecture

### Database Per Service Pattern

```
┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│   Seat Service     │    │  Check-In Service  │    │  Payment Service   │
├────────────────────┤    ├────────────────────┤    ├────────────────────┤
│                    │    │                    │    │                    │
│  MongoDB           │    │  MongoDB           │    │  MongoDB           │
│  ┌──────────────┐ │    │  ┌──────────────┐ │    │  ┌──────────────┐ │
│  │   Seats      │ │    │  │  CheckIns    │ │    │  │  Payments    │ │
│  │  Collection  │ │    │  │  Collection  │ │    │  │  Collection  │ │
│  └──────────────┘ │    │  └──────────────┘ │    │  └──────────────┘ │
│                    │    │                    │    │                    │
└────────────────────┘    └────────────────────┘    └────────────────────┘

┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│  Waitlist Service  │    │    Abuse Det Svc   │    │                    │
├────────────────────┤    ├────────────────────┤    │   Shared MongoDB   │
│                    │    │                    │    │    Replica Set     │
│  MongoDB           │    │  MongoDB           │    │                    │
│  ┌──────────────┐ │    │  ┌──────────────┐ │    │  • Primary Node    │
│  │ Waitlists    │ │    │  │ AuditLogs    │ │    │  • Secondary Node  │
│  │  Collection  │ │    │  │  Collection  │ │    │  • Arbiter Node    │
│  └──────────────┘ │    │  └──────────────┘ │    │                    │
│                    │    │                    │    │  • Auto-Failover   │
└────────────────────┘    └────────────────────┘    │  • Data Redundancy │
                                                     └────────────────────┘
```

**Advantages**:
1. **Service Independence**: Services can evolve schemas independently
2. **Technology Freedom**: Choose optimal database per service
3. **Scalability**: Scale databases independently based on load
4. **Fault Isolation**: Database failure affects only one service
5. **Performance**: Optimized for specific access patterns

**Challenges**:
1. **Data Consistency**: Eventual consistency via events
2. **Joins**: Cross-service queries require aggregation at application layer
3. **Transactions**: Saga pattern for distributed transactions

---

### State History Tracking

All domain entities maintain complete state history:

```javascript
stateHistory: [
  {
    state: "AVAILABLE",
    timestamp: ISODate("2026-02-22T10:00:00Z"),
    triggeredBy: "SYSTEM_INIT",
    metadata: {}
  },
  {
    state: "HELD",
    timestamp: ISODate("2026-02-22T10:15:30Z"),
    triggeredBy: "P_12345",
    metadata: {
      checkInId: "ci_abc123",
      holdDuration: 20
    }
  },
  {
    state: "CONFIRMED",
    timestamp: ISODate("2026-02-22T10:16:45Z"),
    triggeredBy: "SYSTEM",
    metadata: {
      paymentId: null,
      boardingPassGenerated: true
    }
  }
]
```

**Benefits**:
- Complete audit trail
- Debugging and troubleshooting
- Analytics and reporting
- Compliance requirements
- Time-travel queries

---

## Security Architecture

### Multi-Layer Security

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LAYER 1: Network                            │
│                                                                     │
│  • Docker Network Isolation                                         │
│  • Service-to-Service DNS Resolution                                │
│  • No Direct External Access to Services                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LAYER 2: API Gateway                           │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Authentication                                               │ │
│  │  • JWT Token Validation                                       │ │
│  │  • Token Expiry Check (24 hours)                              │ │
│  │  • Bearer Token Extraction                                    │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Authorization                                                │ │
│  │  • Role-Based Access Control (RBAC)                           │ │
│  │  • Permission-Based Authorization                             │ │
│  │  • Resource-Level Access Control                              │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Rate Limiting                                                │ │
│  │  • 100 requests/minute per user                               │ │
│  │  • Redis-backed sliding window                                │ │
│  │  • IP-based limits for unauthenticated requests               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Security Headers (Helmet)                                    │ │
│  │  • Content-Security-Policy                                    │ │
│  │  • X-Frame-Options: DENY                                      │ │
│  │  • X-Content-Type-Options: nosniff                            │ │
│  │  • Strict-Transport-Security                                  │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   LAYER 3: Service Level                            │
│                                                                     │
│  • Input Validation                                                 │
│  • Business Rule Enforcement                                        │
│  • Data Sanitization                                                │
│  • Error Masking (no sensitive data in errors)                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   LAYER 4: Data Layer                               │
│                                                                     │
│  • MongoDB Authentication                                           │
│  • Encrypted Connections (TLS)                                      │
│  • Role-Based Database Access                                       │
│  • Query Parameterization (SQL Injection Prevention)                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                LAYER 5: Abuse Detection                             │
│                                                                     │
│  • Pattern Detection (Rapid Access, Hold Spam)                      │
│  • Automatic Blocking (5-10 minute TTL)                             │
│  • CAPTCHA Challenge for Blocked Users                              │
│  • Audit Logging to MongoDB                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Authentication Flow

```
┌─────────┐                 ┌────────────┐                 ┌──────────┐
│ Client  │                 │ API Gateway│                 │ Service  │
└────┬────┘                 └─────┬──────┘                 └────┬─────┘
     │                            │                             │
     │  POST /auth/login          │                             │
     │  {email, password}         │                             │
     ├───────────────────────────>│                             │
     │                            │                             │
     │                       ┌────▼────┐                        │
     │                       │ Validate│                        │
     │                       │Credntls │                        │
     │                       └────┬────┘                        │
     │                            │                             │
     │                       ┌────▼────┐                        │
     │                       │Generate │                        │
     │                       │ JWT     │                        │
     │                       │ Token   │                        │
     │                       └────┬────┘                        │
     │                            │                             │
     │  {token, user}             │                             │
     │◄───────────────────────────┤                             │
     │                            │                             │
     │  GET /flights/SK123/seatmap                              │
     │  Authorization: Bearer <token>                           │
     ├───────────────────────────>│                             │
     │                            │                             │
     │                       ┌────▼────┐                        │
     │                       │ Verify  │                        │
     │                       │ Token   │                        │
     │                       └────┬────┘                        │
     │                            │                             │
     │                       ┌────▼────┐                        │
     │                       │ Extract │                        │
     │                       │ User    │                        │
     │                       │ Claims  │                        │
     │                       └────┬────┘                        │
     │                            │                             │
     │                       ┌────▼────┐                        │
     │                       │ Check   │                        │
     │                       │ Perms   │                        │
     │                       └────┬────┘                        │
     │                            │                             │
     │                            │  Forward Request            │
     │                            │  + User Context             │
     │                            ├────────────────────────────>│
     │                            │                             │
     │                            │  Response                   │
     │                            │◄────────────────────────────┤
     │                            │                             │
     │  Response Data             │                             │
     │◄───────────────────────────┤                             │
     └────────────────────────────┘                             └
```

**JWT Payload**:
```javascript
{
  "userId": "U_12345",
  "role": "passenger",              // passenger | staff | admin
  "loyaltyTier": "GOLD",            // GOLD | SILVER | BRONZE
  "permissions": [
    "book:seat",
    "cancel:checkin",
    "join:waitlist"
  ],
  "iat": 1771795214,                // Issued at
  "exp": 1771881614,                // Expires at (24h)
  "aud": "skyhigh-api",             // Audience
  "iss": "skyhigh-core"             // Issuer
}
```

---

## Deployment Architecture

### Docker Compose Deployment

```
┌────────────────────────────────────────────────────────────────────┐
│                      Docker Host                                   │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              skyhigh-network (Bridge Network)                │ │
│  │                                                              │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │ │
│  │  │API Gateway  │  │ Seat Service│  │CheckIn Svc  │        │ │
│  │  │             │  │             │  │             │        │ │
│  │  │ Port: 3000  │  │ Port: 3001  │  │ Port: 3002  │        │ │
│  │  │ Health: ✓   │  │ Replicas: 1 │  │ Replicas: 1 │        │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │ │
│  │                                                              │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │ │
│  │  │Payment Svc  │  │Waitlist Svc │  │ Notify Svc  │        │ │
│  │  │             │  │             │  │             │        │ │
│  │  │ Port: 3003  │  │ Port: 3004  │  │ Port: 3005  │        │ │
│  │  │ Replicas: 1 │  │ Replicas: 1 │  │ Replicas: 1 │        │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │ │
│  │                                                              │ │
│  │  ┌─────────────┐  ┌─────────────┐                          │ │
│  │  │ Weight Svc  │  │  Abuse Det  │                          │ │
│  │  │             │  │             │                          │ │
│  │  │ Port: 3006  │  │ Port: 3007  │                          │ │
│  │  │ Replicas: 1 │  │ Replicas: 1 │                          │ │
│  │  └─────────────┘  └─────────────┘                          │ │
│  │                                                              │ │
│  │  ┌──────────────────────────┐  ┌───────────────────────┐  │ │
│  │  │    MongoDB (Replica Set) │  │      Redis            │  │ │
│  │  │                          │  │                       │  │ │
│  │  │  Primary: mongodb:27017  │  │  redis:6379           │  │ │
│  │  │  Health: ✓               │  │  Health: ✓            │  │ │
│  │  │  Volume: mongodb_data    │  │  Volume: redis_data   │  │ │
│  │  └──────────────────────────┘  └───────────────────────┘  │ │
│  │                                                              │ │
│  │  ┌─────────────────┐                                        │ │
│  │  │Redis Commander  │                                        │ │
│  │  │                 │                                        │ │
│  │  │ Port: 8081      │                                        │ │
│  │  │ Web UI          │                                        │ │
│  │  └─────────────────┘                                        │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    Persistent Volumes                        │ │
│  │                                                              │ │
│  │  • mongodb_data     (MongoDB data files)                    │ │
│  │  • redis_data       (Redis persistence)                     │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

                           External Access
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
            localhost:3000  localhost:8081  localhost:27017
            (API Gateway)   (Redis UI)     (MongoDB)
```

---

### Container Build Strategy

**Multi-Stage Dockerfile**:
```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.build.json ./
RUN npm ci
COPY src ./src
RUN npx tsc -p tsconfig.build.json

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs
EXPOSE 3000
CMD ["node", "dist/api-gateway/index.js"]
```

**Benefits**:
- Smaller final image (excludes dev dependencies & source)
- Security (non-root user)
- Layer caching for faster builds
- Alpine base for minimal footprint

---

### Service Discovery

Services communicate using DNS-based service discovery:

```javascript
// Service URLs in .env.docker
SEAT_SERVICE_URL=http://seat-service:3001
CHECKIN_SERVICE_URL=http://checkin-service:3002
PAYMENT_SERVICE_URL=http://payment-service:3003

// Docker Compose automatically resolves:
// seat-service → 172.20.0.X
// checkin-service → 172.20.0.Y
// payment-service → 172.20.0.Z
```

---

## Scalability & Performance

### Horizontal Scaling Strategy

```
                        ┌─────────────────┐
                        │  Load Balancer  │
                        │    (Nginx)      │
                        └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │API Gateway  │ │API Gateway  │ │API Gateway  │
            │  Instance 1 │ │  Instance 2 │ │  Instance 3 │
            └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
                   │               │               │
                   └───────────────┼───────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │Seat Service │ │CheckIn Svc  │ │Payment Svc  │
            │  Instance 1 │ │  Instance 1 │ │  Instance 1 │
            │  Instance 2 │ │  Instance 2 │ │  Instance 2 │
            │  Instance 3 │ │  Instance 3 │ │  Instance 3 │
            └─────────────┘ └─────────────┘ └─────────────┘
                   │               │               │
                   └───────────────┼───────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
            ┌──────────────┐  ┌──────────────┐ ┌──────────────┐
            │  MongoDB     │  │    Redis     │ │Redis Cluster │
            │ Replica Set  │  │   Sentinel   │ │ (Sharding)   │
            │              │  │              │ │              │
            │ • Primary    │  │ • Master     │ │ • Shard 1    │
            │ • Secondary  │  │ • Slave 1    │ │ • Shard 2    │
            │ • Secondary  │  │ • Slave 2    │ │ • Shard 3    │
            └──────────────┘  └──────────────┘ └──────────────┘
```

**Scaling Strategies**:

1. **Stateless Services**: All services are stateless (state in DB/Redis)
2. **Load Balancing**: Round-robin or least-connections
3. **Auto-Scaling**: Based on CPU/Memory metrics
4. **Database Scaling**:
   - Read replicas for MongoDB
   - Redis Sentinel for HA
   - Redis Cluster for sharding
5. **Caching**: Reduce database load

---

### Performance Optimization

**1. Database Optimization**:
```javascript
// Compound indexes for frequent queries
{ seatId: 1, flightId: 1 }  // Unique constraint + fast lookups
{ flightId: 1, state: 1 }    // Seat map queries
{ state: 1, holdExpiresAt: 1 } // Expiration job

// Connection pooling
maxPoolSize: 100
minPoolSize: 10
```

**2. Caching Strategy**:
```javascript
// Cache seat maps for 30 seconds
key: `seatmap:${flightId}`
ttl: 30

// Invalidate on state changes
- seat.confirmed → invalidate seatmap
- seat.released → invalidate seatmap
```

**3. API Response Optimization**:
```javascript
// Pagination for large result sets
GET /waitlist?page=1&limit=20

// Field projection (return only needed fields)
GET /seats?fields=seatId,state,type

// Response compression (gzip)
```

**4. Background Jobs**:
```javascript
// Hold expiration runs every 5 seconds
setInterval(processExpiredHolds, 5000)

// Batch processing (100 seats per transaction)
```

---

## Resilience & Reliability

### Fault Tolerance Mechanisms

**1. Circuit Breaker Pattern** (Future Enhancement):
```
┌─────────────┐         ┌─────────────┐
│  Service A  │────────>│  Service B  │
└─────────────┘         └─────────────┘
                              │
                        ┌─────▼─────┐
                        │  Circuit  │
                        │  Breaker  │
                        └─────┬─────┘
                              │
                    ┌─────────┼─────────┐
                    │         │         │
                    ▼         ▼         ▼
              ┌────────┐ ┌────────┐ ┌────────┐
              │ CLOSED │ │  OPEN  │ │HALF-   │
              │(Normal)│ │(Failed)│ │ OPEN   │
              └────────┘ └────────┘ └────────┘
```

**2. Retry Logic** (Future Enhancement):
```javascript
// Exponential backoff
retries: 3
delays: [1s, 2s, 4s]
```

**3. Graceful Degradation**:
- Weight Service failure → Manual weight entry
- Notification Service failure → Log for retry
- Cache failure → Direct database query

**4. Health Checks**:
```javascript
GET /health

Response:
{
  "status": "OK",
  "service": "api-gateway",
  "timestamp": "2026-02-22T10:15:30Z"
}
```

---

### Data Consistency

**1. Eventual Consistency**:
- Event-driven updates allow temporary inconsistency
- Acceptable for most operations
- Eventually consistent via event processing

**2. Strong Consistency**:
- MongoDB transactions for critical operations
- Seat holds/confirmations use transactions
- Payment confirmations use transactions

**3. Saga Pattern** (for distributed transactions):
```
Start Check-In → Hold Seat → Validate Baggage → Create Payment
     ↓              ↓              ↓                 ↓
   Success       Success         Success          Success
     │              │              │                 │
     └──────────────┴──────────────┴─────────────────┘
                          │
                    ┌─────▼─────┐
                    │  COMMIT   │
                    └───────────┘

Compensating Transactions:
- Release Seat if payment fails
- Cancel check-in if seat confirmation fails
```

---

## Monitoring & Observability

### Logging Strategy

**Structured Logging with Winston**:
```javascript
{
  "level": "info",
  "message": "HTTP Request",
  "service": "api-gateway",
  "environment": "production",
  "timestamp": "2026-02-22T10:15:30.123Z",
  "requestId": "req_abc123",
  "method": "POST",
  "url": "/api/v1/checkin/start",
  "statusCode": 200,
  "duration": "45ms",
  "userId": "U_12345"
}
```

**Log Levels**:
- `error`: Failures requiring attention
- `warn`: Potential issues
- `info`: Important business events
- `debug`: Detailed diagnostic info (dev only)

---

### Metrics & Monitoring (Future Enhancement)

**Prometheus Metrics**:
```
# Request metrics
http_requests_total{service="seat-service", status="200"}
http_request_duration_seconds{service="seat-service"}

# Business metrics
seats_held_total{flight="SK123"}
checkins_completed_total
payments_failed_total

# System metrics
nodejs_heap_size_bytes
nodejs_event_loop_lag_seconds
```

**Grafana Dashboards**:
- Service health overview
- Request throughput & latency
- Error rates
- Database performance
- Cache hit rates

---

### Distributed Tracing (Future Enhancement)

**Jaeger/Zipkin Integration**:
```
Request Flow Trace:
┌─────────────────────────────────────────────────────────────┐
│ TraceID: abc123                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Span 1: API Gateway [200ms]                                │
│   └─ Span 2: Check-In Service [180ms]                      │
│       ├─ Span 3: Seat Service [50ms]                       │
│       ├─ Span 4: Weight Service [30ms]                     │
│       └─ Span 5: Payment Service [80ms]                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture Evolution Roadmap

### Phase 1: Current State ✓
- Microservices architecture
- MongoDB + Redis
- Docker Compose deployment
- Event-driven communication
- JWT authentication

### Phase 2: Enhanced Reliability
- Circuit breaker pattern
- Retry logic with exponential backoff
- Health check improvements
- Graceful shutdown

### Phase 3: Observability
- Prometheus metrics
- Grafana dashboards
- Distributed tracing (Jaeger)
- Centralized logging (ELK stack)

### Phase 4: Cloud Native
- Kubernetes deployment
- Service mesh (Istio)
- Auto-scaling policies
- Multi-region deployment

### Phase 5: Advanced Features
- GraphQL gateway
- Real-time updates (WebSocket)
- ML-based seat recommendations
- Predictive analytics

---

This architecture provides a solid foundation for a production-grade airline check-in system, with clear paths for evolution and scaling as business needs grow.
