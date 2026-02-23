# Product Requirements Document (PRD)
## SkyHigh Core – Digital Check-In System

**Document Version:** 1.0  
**Last Updated:** February 21, 2026  
**Document Owner:** Product Management  
**Status:** Draft for Review

---

## 1. Executive Summary

### 1.1 Overview
SkyHigh Airlines is developing **SkyHigh Core**, a high-performance backend service to power its next-generation digital check-in experience. The system must handle hundreds of concurrent passengers during peak check-in windows while ensuring seat assignment accuracy, preventing conflicts, and providing a seamless user experience.

### 1.2 Business Objectives
- **Eliminate seat assignment conflicts** during concurrent check-in operations
- **Reduce check-in time** from 8 minutes to under 3 minutes per passenger
- **Handle 500+ concurrent users** during peak check-in periods
- **Prevent revenue leakage** from baggage fee collection failures
- **Protect system integrity** from automated abuse and bot traffic

### 1.3 Success Criteria
| Metric | Target | Current Baseline |
|--------|--------|------------------|
| Seat conflict incidents | 0 per day | 12-15 per day |
| P95 seat map load time | < 1 second | 3-5 seconds |
| Concurrent user capacity | 500+ | ~100 |
| Check-in completion rate | > 95% | 78% |
| Baggage fee capture rate | > 99% | 85% |
| Bot detection accuracy | > 98% | N/A (manual only) |

---

## 2. Problem Statement

### 2.1 Current Pain Points

**For Passengers:**
- Frequent "seat already taken" errors during selection
- System timeouts during peak hours
- Lost check-in progress when payment is required
- Inability to secure preferred seats

**For Business:**
- Lost baggage fee revenue (~$450K annually)
- Customer service escalations from seat conflicts (avg 15/day)
- System downtime during peak check-in windows
- Manual intervention required for conflict resolution

### 2.2 Root Causes
1. **Race Conditions:** Legacy system lacks proper seat locking mechanism
2. **No State Management:** Seat reservations not time-bound or tracked
3. **Poor Scalability:** Database bottlenecks under concurrent load
4. **No Abuse Protection:** Bots can overwhelm seat availability queries

---

## 3. Target Users & Personas

### 3.1 Primary Users

#### Persona 1: The Efficient Traveler (Sarah)
- **Profile:** Business traveler, flies 2x/month, tech-savvy
- **Goals:** Quick check-in (< 2 min), select aisle seat, minimal friction
- **Pain Points:** Seat conflicts, slow loading times
- **Success Metric:** Can complete check-in in under 2 minutes

#### Persona 2: The Budget-Conscious Family (The Johnsons)
- **Profile:** Family of 4, annual vacation, price-sensitive
- **Goals:** Sit together, avoid extra fees, understand baggage limits
- **Pain Points:** Confusion about baggage fees, losing selected seats
- **Success Metric:** Clear baggage pricing, seats stay held during decision-making

#### Persona 3: The Last-Minute Passenger (Mike)
- **Profile:** Occasional traveler, checks in during peak hours
- **Goals:** Get any available seat quickly
- **Pain Points:** System unavailability, long wait times
- **Success Metric:** System remains responsive during peak load

### 3.2 Secondary Users

#### Airport Staff
- **Needs:** Override capabilities, conflict resolution tools
- **Success Metric:** Can resolve edge cases in < 1 minute

#### Customer Service Representatives
- **Needs:** Visibility into check-in state, cancellation tools
- **Success Metric:** Can diagnose passenger issues in real-time

---

## 4. Functional Requirements

### 4.1 Seat Lifecycle Management

#### FR-1.1: Seat State Machine
**Priority:** P0 (Must Have)

**Description:**  
Each seat must follow a strict lifecycle with defined state transitions.

**State Definitions:**
```
AVAILABLE → HELD → CONFIRMED
     ↓         ↓         ↓
     ← ← ← CANCELLED ← ←
```

| State | Description | Business Rules |
|-------|-------------|----------------|
| **AVAILABLE** | Seat is unassigned and can be selected | • Displayed in seat map<br>• Multiple users can view simultaneously<br>• Can transition to HELD |
| **HELD** | Seat is temporarily reserved for 1 passenger | • Exclusive lock for 120 seconds<br>• Not visible to other passengers<br>• Auto-expires to AVAILABLE if not confirmed<br>• Can transition to CONFIRMED or AVAILABLE |
| **CONFIRMED** | Seat is permanently assigned | • Linked to passenger booking<br>• Appears on boarding pass<br>• Can only transition to CANCELLED |
| **CANCELLED** | Seat released by passenger cancellation | • Immediately transitions to AVAILABLE<br>• Triggers waitlist processing |

**Acceptance Criteria:**
- [ ] System enforces valid state transitions only
- [ ] Invalid state transitions return error code `INVALID_STATE_TRANSITION`
- [ ] State changes are logged with timestamp and passenger ID
- [ ] State queries return consistent results across concurrent requests

---

#### FR-1.2: Time-Bound Seat Reservations
**Priority:** P0 (Must Have)

**Description:**  
When a passenger selects a seat, the system must hold it exclusively for exactly 120 seconds.

**Business Rules:**
1. **Hold Initiation:**
   - Seat must be in AVAILABLE state
   - Only one hold allowed per seat at any time
   - Hold timer starts immediately upon successful reservation

2. **Hold Duration:**
   - Fixed duration: 120 seconds (2 minutes)
   - Timer is not extendable by user action
   - System must display countdown to user (UI requirement)

3. **Hold Expiration:**
   - At 120 seconds, seat automatically returns to AVAILABLE
   - Expiration must occur even if server restarts
   - Expired holds must trigger re-check of waitlist

4. **Hold Exclusivity:**
   - During hold period, seat is invisible to other passengers
   - Other passengers see seat as unavailable (no state shown)
   - Only the holding passenger can confirm or release

**Technical Requirements:**
- Background job must check for expired holds every 10 seconds
- Hold expiration must not depend on user action
- System clock drift must be accounted for (use UTC timestamps)

**Acceptance Criteria:**
- [ ] Seat holds expire exactly at 120 seconds (±2 second tolerance)
- [ ] Expired seats become immediately available to other passengers
- [ ] Hold timer persists across server restarts
- [ ] Load test with 100 concurrent holds shows 100% accuracy

---

#### FR-1.3: Conflict-Free Seat Assignment
**Priority:** P0 (Must Have)

**Description:**  
The system must guarantee that no two passengers can hold or confirm the same seat simultaneously, even under extreme concurrent load.

**Hard Guarantee:**
> If 100 passengers attempt to reserve Seat 12A at the same millisecond, exactly 1 reservation succeeds and 99 requests fail gracefully.

**Business Rules:**
1. **Atomic Reservation:**
   - Seat state check and update must be atomic (single transaction)
   - No "check-then-update" pattern allowed
   - Use database-level locking or optimistic concurrency control

2. **Failure Handling:**
   - Failed requests receive error code `SEAT_UNAVAILABLE`
   - System suggests 3 alternative similar seats (same row/aisle preference)
   - User can retry immediately

3. **Consistency Model:**
   - Strong consistency required (no eventual consistency)
   - Distributed systems must use consensus (e.g., distributed locks)

**Technical Requirements:**
- Implement using MongoDB multi-document transactions with findAndModify operations
- Use optimistic concurrency control with version fields
- Alternative: Redis distributed locks for cross-instance coordination
- Transaction timeout: 5 seconds (to prevent deadlocks)
- Retry logic for transient failures (max 3 retries)

**Acceptance Criteria:**
- [ ] Load test: 500 concurrent requests for same seat → exactly 1 success
- [ ] Zero duplicate seat assignments in 24-hour production test
- [ ] Failed requests receive alternative suggestions within 200ms
- [ ] System maintains consistency across multiple server instances

---

### 4.2 Check-In Process Management

#### FR-2.1: Check-In Flow Orchestration
**Priority:** P0 (Must Have)

**Description:**  
Manage the multi-step check-in process with clear state tracking and recovery.

**Check-In Steps:**
```
1. Passenger Authentication → 2. Seat Selection → 3. Baggage Declaration → 
4. Payment (if needed) → 5. Confirmation → 6. Boarding Pass Generation
```

**Check-In States:**
| State | Description | User Actions Available |
|-------|-------------|------------------------|
| `NOT_STARTED` | Passenger has not initiated check-in | Start check-in |
| `IN_PROGRESS` | Actively selecting seat/adding baggage | Continue, Cancel |
| `AWAITING_PAYMENT` | Baggage fee payment required | Pay, Modify Baggage, Cancel |
| `COMPLETED` | Check-in successful, boarding pass issued | View Boarding Pass, Cancel Check-In |
| `CANCELLED` | Passenger cancelled check-in | Restart Check-In |

**Business Rules:**
- Passenger can resume `IN_PROGRESS` check-in within 24 hours
- `AWAITING_PAYMENT` state holds seat for 30 minutes (extended hold)
- `COMPLETED` check-in can be cancelled up to 2 hours before departure
- State transitions are idempotent (retry-safe)

**Acceptance Criteria:**
- [ ] Check-in state persists across user sessions
- [ ] Payment link remains valid for 30 minutes
- [ ] User can resume interrupted check-in from any device

---

#### FR-2.2: Baggage Validation & Fee Enforcement
**Priority:** P0 (Must Have)

**Description:**  
Validate baggage weight and enforce payment for overweight baggage before allowing check-in completion.

**Business Rules:**

**Weight Limits:**
- Standard allowance: 25kg per bag (free)
- Overweight: 25.01kg - 32kg (additional fee required)
- Prohibited: > 32kg (must be rejected, cannot check in)

**Fee Structure:**
| Weight Range | Fee per Bag |
|--------------|-------------|
| 0 - 25.00kg | $0 (included) |
| 25.01 - 28.00kg | $50 |
| 28.01 - 32.00kg | $100 |
| > 32.00kg | Not Allowed |

**Process Flow:**
1. Passenger declares number of bags
2. System calls **Weight Service API** to get bag weights
3. If any bag > 25kg:
   - Check-in state → `AWAITING_PAYMENT`
   - Calculate total fee
   - Generate payment link (via **Payment Service**)
   - Send payment notification to passenger
4. Upon payment confirmation:
   - Check-in state → `IN_PROGRESS`
   - Allow check-in to complete
5. If bag > 32kg:
   - Block check-in
   - Return error: `BAGGAGE_TOO_HEAVY`
   - Suggest cargo shipping option

**External Service Dependencies:**
- **Weight Service:** `POST /api/v1/baggage/weigh` → Returns `{ bagId, weight }`
- **Payment Service:** `POST /api/v1/payments/initiate` → Returns payment URL

**Acceptance Criteria:**
- [ ] Baggage > 25kg blocks check-in completion until payment
- [ ] Baggage > 32kg prevents check-in with clear error message
- [ ] Payment state persists if user closes browser
- [ ] Fee calculation is accurate to 2 decimal places
- [ ] System handles Weight Service timeout (fallback to manual entry)

---

### 4.3 Waitlist Management

#### FR-3.1: Automatic Waitlist Assignment
**Priority:** P1 (Should Have)

**Description:**  
When a passenger's preferred seat is unavailable, they can join a waitlist. When the seat becomes available, the system automatically assigns it to the next eligible passenger.

**Business Rules:**

**Waitlist Eligibility:**
- Passenger must have an active booking
- Maximum 1 waitlist entry per passenger per flight
- Waitlist entries expire 3 hours before departure

**Priority Order:**
1. Loyalty tier (Platinum → Gold → Silver → Regular)
2. Booking timestamp (earlier bookings first)
3. Special needs (passengers with disabilities)

**Assignment Trigger Events:**
- Seat hold expires (120 seconds elapsed)
- Passenger cancels confirmed check-in
- Seat released by airline operations

**Assignment Process:**
1. Seat becomes AVAILABLE
2. System queries waitlist for highest priority passenger
3. If match found:
   - Seat → HELD for 5 minutes (extended time for notification response)
   - Send push notification + email to passenger
   - Passenger has 5 minutes to confirm
4. If passenger doesn't respond:
   - Seat offered to next waitlist passenger
   - Repeat until assigned or no waitlist remains

**Notification Requirements:**
- Real-time push notification (< 5 seconds)
- Email notification (< 30 seconds)
- In-app notification banner

**Acceptance Criteria:**
- [ ] Waitlisted passenger receives notification within 5 seconds
- [ ] Priority order is correctly enforced
- [ ] Expired waitlist entries are auto-removed
- [ ] Passenger can opt-out of waitlist at any time

---

### 4.4 Seat Map Performance

#### FR-4.1: High-Performance Seat Map Rendering
**Priority:** P0 (Must Have)

**Description:**  
Seat map browsing is the most frequent operation (80% of API traffic). The system must deliver seat availability data with minimal latency under high concurrency.

**Performance Targets:**
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| P50 Response Time | < 300ms | Server-side timing |
| P95 Response Time | < 1 second | Server-side timing |
| P99 Response Time | < 2 seconds | Server-side timing |
| Concurrent Users | 500+ | Load testing |
| Cache Hit Rate | > 90% | Cache metrics |

**Business Rules:**
- Seat map data can be cached for 5 seconds (acceptable staleness)
- Available seat count must be accurate (no cache for counts)
- Seat state (AVAILABLE/UNAVAILABLE) can show 5-second lag

**Technical Requirements:**

**Caching Strategy:**
- Cache full seat map layout (seat numbers, positions) for 24 hours
- Cache seat availability for 5 seconds with cache invalidation on state change
- Use Redis or in-memory cache

**Data Optimization:**
- Return only seat ID, state, and price (minimize payload)
- Use gzip compression for API responses
- Consider GraphQL for client-specified fields

**Database Optimization:**
- Index on `flight_id` + `seat_state`
- Use read replicas for seat map queries
- Partition large tables by flight date

**Acceptance Criteria:**
- [ ] Load test: 500 concurrent seat map requests → P95 < 1s
- [ ] Zero database connection pool exhaustion under peak load
- [ ] Cache hit rate > 90% during 1-hour peak window
- [ ] API response size < 50KB per seat map

---

### 4.5 Abuse & Bot Detection

#### FR-5.1: Automated Access Pattern Detection
**Priority:** P1 (Should Have)

**Description:**  
Detect and block suspicious access patterns that may indicate bot activity, seat hoarding, or system abuse.

**Detection Rules:**

**Rule 1: Rapid Seat Map Access**
- **Trigger:** Single source (IP/User ID) accesses > 50 unique seat maps in < 2 seconds
- **Action:** Block further seat map requests for 5 minutes
- **Exemption:** Airport kiosk IP ranges

**Rule 2: Rapid Seat Hold/Release**
- **Trigger:** Single user holds > 10 different seats within 5 minutes
- **Action:** Require CAPTCHA for next seat selection
- **Escalation:** After 3 CAPTCHA failures → 30-minute suspension

**Rule 3: API Rate Limiting**
- **Standard User:** 100 requests/minute
- **Authenticated User:** 200 requests/minute
- **Loyalty Member:** 300 requests/minute

**Detection Implementation:**
- Use sliding window algorithm (not fixed window)
- Track by: IP address + User ID + Session ID
- Store detection events in audit log
- Real-time alerting for suspicious patterns

**Response Actions:**
| Severity | Action | Duration |
|----------|--------|----------|
| Low | Rate limit (429 error) | 1 minute |
| Medium | Require CAPTCHA | Until completed |
| High | Temporary block | 30 minutes |
| Critical | Account suspension | Manual review required |

**Monitoring & Audit:**
- Log all blocked requests with reason code
- Daily report of top blocked sources
- Integration with fraud detection system

**Acceptance Criteria:**
- [ ] Bot accessing 100 seat maps in 1 second is blocked
- [ ] Legitimate user accessing 10 seat maps in 10 seconds is not blocked
- [ ] CAPTCHA challenge appears within 200ms of trigger
- [ ] Audit log captures IP, user ID, timestamp, and action taken

---

### 4.6 Cancellation Management

#### FR-6.1: Passenger-Initiated Cancellation
**Priority:** P0 (Must Have)

**Description:**  
Allow passengers to cancel confirmed check-in before departure, with seat immediately released back to the pool.

**Business Rules:**

**Cancellation Window:**
- Allowed: Up to 2 hours before scheduled departure
- Restricted: Within 2 hours of departure (requires airport staff approval)
- Prohibited: After boarding has started

**Cancellation Process:**
1. Passenger initiates cancellation (via app/website)
2. System validates cancellation window
3. If allowed:
   - Seat state → CANCELLED → AVAILABLE (immediate transition)
   - Check-in state → CANCELLED
   - Waitlist triggered (if applicable)
   - Confirmation email sent
4. If restricted:
   - Return error: `CANCELLATION_WINDOW_CLOSED`
   - Provide customer service contact info

**Refund Policy (Not in Scope for SkyHigh Core):**
- Seat selection fees are refundable (handled by billing system)
- Baggage fees are non-refundable (business rule)

**Waitlist Integration:**
- Upon cancellation, seat offered to waitlist immediately
- Original passenger loses priority if they re-check-in later

**Edge Cases:**
- **Flight Delay:** Cancellation window extends with new departure time
- **Already Boarded:** Cancellation prohibited (seat released manually by crew)

**Acceptance Criteria:**
- [ ] Cancelled seat appears as AVAILABLE within 2 seconds
- [ ] Waitlist assignment triggered within 5 seconds of cancellation
- [ ] Passenger receives cancellation confirmation email within 30 seconds
- [ ] Cancellation within restricted window returns clear error message

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| **Seat Map Load Time (P95)** | < 1 second | APM tools (New Relic/Datadog) |
| **Seat Reservation Latency (P99)** | < 500ms | API response time |
| **Check-In Completion Time** | < 3 minutes | End-to-end user flow |
| **Concurrent Users** | 500+ | Load testing (k6/JMeter) |
| **API Throughput** | 1000 requests/second | Server metrics |
| **Database Query Time (P95)** | < 100ms | Database slow query log |

### 5.2 Availability & Reliability

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| **System Uptime** | 99.9% (43 min downtime/month) | Uptime monitoring |
| **Data Durability** | 99.999% (no seat assignment loss) | Database replication |
| **Failover Time** | < 30 seconds | Disaster recovery drills |
| **Backup Frequency** | Every 1 hour | Automated backups |

### 5.3 Scalability

**Vertical Scaling:**
- Support 500 concurrent users with single server instance
- CPU utilization < 70% under peak load
- Memory utilization < 80% under peak load

**Horizontal Scaling:**
- Stateless API design (load balancer compatible)
- Support 5000+ concurrent users with 10 server instances
- Auto-scaling based on CPU/memory thresholds

**Database Scaling:**
- Read replicas for seat map queries
- Write master for seat state changes
- Connection pooling (min 10, max 100 connections)

### 5.4 Security

**Authentication & Authorization:**
- OAuth 2.0 / JWT for API authentication
- Role-based access control (RBAC)
  - Passenger: Can manage own check-in
  - Airport Staff: Can override seat assignments
  - Admin: Full system access

**Data Protection:**
- TLS 1.3 for all API communication
- Encrypt PII at rest (AES-256)
- PCI DSS compliance for payment data (handled by Payment Service)

**Audit & Compliance:**
- Log all seat state changes with timestamp, user ID, IP
- Retain audit logs for 7 years (regulatory requirement)
- GDPR compliance (data deletion on request)

### 5.5 Monitoring & Observability

**Logging:**
- Structured JSON logs (timestamp, level, service, message, context)
- Centralized log aggregation (ELK stack / CloudWatch)
- Log retention: 90 days

**Metrics:**
- API response times (p50, p95, p99)
- Error rates by endpoint
- Seat state distribution (AVAILABLE, HELD, CONFIRMED)
- Cache hit/miss rates
- Database connection pool usage

**Alerts:**
- Critical: P95 latency > 2 seconds → Page on-call engineer
- High: Error rate > 5% → Slack notification
- Medium: Cache hit rate < 80% → Email to DevOps
- Low: Disk usage > 80% → Ticket created

**Tracing:**
- Distributed tracing for multi-service requests (Jaeger/Zipkin)
- Trace ID propagation across Weight Service, Payment Service

---

## 6. Technical Architecture (High-Level)

### 6.1 System Components

```
┌─────────────────┐
│   Mobile App    │
│   Web App       │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  API Gateway    │ ← Rate Limiting, Auth
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SkyHigh Core   │ ← Seat Management, Check-In Logic
│  (Backend API)  │
└────┬───┬───┬────┘
     │   │   │
     │   │   └──────→ ┌──────────────┐
     │   │            │ Weight Service│
     │   │            └──────────────┘
     │   │
     │   └──────────→ ┌──────────────┐
     │                │Payment Service│
     │                └──────────────┘
     │
     ▼
┌─────────────────┐
│   Database      │ ← MongoDB
│   (Primary +    │   (Seat State, Check-In State)
│    Replicas)    │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Redis Cache    │ ← Seat Map Cache, Session Data
└─────────────────┘
```

### 6.2 Technology Stack Recommendations

**Backend:**
- Language: Java (Spring Boot) / Node.js (Express) / Python (FastAPI)
- Framework: RESTful API design
- Authentication: JWT tokens

**Database:**
- Primary: MongoDB 6.0+ (ACID transactions support, flexible document model)
- Features: Multi-document transactions, change streams for real-time updates
- Schema: Document-based design with indexes on query patterns (flight_id, seat state)

**Caching:**
- Redis 7.0+ (in-memory cache, distributed locks)
- Cache invalidation strategy: TTL + event-driven

**Message Queue (Optional for Waitlist):**
- RabbitMQ / AWS SQS for async waitlist notifications

**Monitoring:**
- APM: New Relic / Datadog
- Logging: ELK Stack / AWS CloudWatch
- Tracing: Jaeger / AWS X-Ray

---

## 7. API Specifications (Draft)

### 7.1 Core Endpoints

#### **GET /api/v1/flights/{flightId}/seatmap**
**Description:** Retrieve seat map with availability for a flight

**Response:**
```json
{
  "flightId": "SK123",
  "aircraft": "Boeing 737",
  "totalSeats": 180,
  "availableSeats": 45,
  "seats": [
    {
      "seatId": "12A",
      "row": 12,
      "column": "A",
      "state": "AVAILABLE",
      "type": "AISLE",
      "price": 25.00
    },
    {
      "seatId": "12B",
      "row": 12,
      "column": "B",
      "state": "UNAVAILABLE",
      "type": "MIDDLE"
    }
  ]
}
```

---

#### **POST /api/v1/seats/hold**
**Description:** Reserve a seat for 120 seconds

**Request:**
```json
{
  "flightId": "SK123",
  "seatId": "12A",
  "passengerId": "P12345"
}
```

**Response (Success):**
```json
{
  "holdId": "H789",
  "seatId": "12A",
  "expiresAt": "2026-02-21T10:15:00Z",
  "remainingSeconds": 120
}
```

**Response (Conflict):**
```json
{
  "error": "SEAT_UNAVAILABLE",
  "message": "Seat 12A is no longer available",
  "suggestions": ["12B", "12C", "13A"]
}
```

---

#### **POST /api/v1/checkin/complete**
**Description:** Finalize check-in and confirm seat

**Request:**
```json
{
  "holdId": "H789",
  "passengerId": "P12345",
  "baggage": {
    "count": 2,
    "weights": [23.5, 26.2]
  }
}
```

**Response (Payment Required):**
```json
{
  "status": "AWAITING_PAYMENT",
  "checkInId": "C456",
  "baggageFee": 50.00,
  "paymentUrl": "https://pay.skyhigh.com/xyz123",
  "expiresAt": "2026-02-21T10:45:00Z"
}
```

**Response (Success):**
```json
{
  "status": "COMPLETED",
  "checkInId": "C456",
  "boardingPass": {
    "passengerId": "P12345",
    "flightId": "SK123",
    "seatId": "12A",
    "gate": "B12",
    "boardingTime": "2026-02-21T14:30:00Z",
    "qrCode": "data:image/png;base64,..."
  }
}
```

---

#### **POST /api/v1/checkin/{checkInId}/cancel**
**Description:** Cancel a confirmed check-in

**Response (Success):**
```json
{
  "status": "CANCELLED",
  "seatId": "12A",
  "seatState": "AVAILABLE",
  "refundAmount": 25.00
}
```

**Response (Error):**
```json
{
  "error": "CANCELLATION_WINDOW_CLOSED",
  "message": "Cancellation not allowed within 2 hours of departure",
  "supportContact": "+1-800-SKYHIGH"
}
```

---

#### **POST /api/v1/waitlist/join**
**Description:** Add passenger to seat waitlist

**Request:**
```json
{
  "flightId": "SK123",
  "seatId": "12A",
  "passengerId": "P12345"
}
```

**Response:**
```json
{
  "waitlistId": "W999",
  "position": 3,
  "estimatedWaitTime": "15-30 minutes",
  "notificationPreferences": ["push", "email"]
}
```

---

## 8. User Flows

### 8.1 Happy Path: Successful Check-In

```
1. Passenger opens app → Authentication (JWT)
2. Select Flight SK123 → API: GET /flights/SK123/seatmap
3. Browse seat map → Selects Seat 12A
4. API: POST /seats/hold → Hold created (120s timer starts)
5. Passenger adds 2 bags (23kg, 27kg)
6. System calls Weight Service → Bag 2 overweight detected
7. API: POST /checkin/complete → Status: AWAITING_PAYMENT
8. Passenger pays $50 via Payment Service
9. Payment webhook → SkyHigh Core
10. API: POST /checkin/complete (retry) → Status: COMPLETED
11. Boarding pass displayed → QR code generated
```

**Total Time:** ~2 minutes

---

### 8.2 Edge Case: Seat Conflict

```
1. Passenger A selects Seat 12A at T=0ms
2. Passenger B selects Seat 12A at T=5ms
3. Both requests hit API simultaneously
4. MongoDB findOneAndUpdate with state:AVAILABLE filter executed
5. Passenger A's transaction completes first → Hold successful
6. Passenger B's transaction finds no matching document → Error: SEAT_UNAVAILABLE
7. System suggests alternatives: [12B, 12C, 13A]
8. Passenger B selects 12B → Hold successful
```

**Resolution Time:** < 500ms

---

### 8.3 Edge Case: Hold Expiration

```
1. Passenger holds Seat 12A at 10:00:00
2. Passenger distracted, doesn't complete check-in
3. At 10:02:00, background job detects expired hold
4. Seat 12A → State changed to AVAILABLE
5. Waitlist checked → Passenger C is next in line
6. Seat 12A → HELD for Passenger C (5-minute extended hold)
7. Push notification sent to Passenger C
8. Passenger C confirms within 2 minutes → CONFIRMED
```

**Waitlist Assignment Time:** < 5 seconds

---

## 9. Edge Cases & Error Handling

### 9.1 Race Conditions

| Scenario | Handling Strategy |
|----------|-------------------|
| **Simultaneous seat selection** | MongoDB findOneAndUpdate with state:AVAILABLE filter; first transaction wins atomically |
| **Hold expiration during check-in** | Check hold validity before confirmation; return error if expired |
| **Concurrent cancellations** | Idempotent cancellation API; second call returns success |

### 9.2 External Service Failures

| Service | Failure Mode | Fallback Strategy |
|---------|--------------|-------------------|
| **Weight Service timeout** | No response after 5s | Allow manual weight entry with validation |
| **Mock Payment Service down** | HTTP 503 error | Queue payment for retry; send email link |
| **Notification Service unavailable** | Push notification fails | Retry 3 times; fallback to email only |

### 9.3 Data Consistency Issues

| Issue | Detection | Resolution |
|-------|-----------|------------|
| **Orphaned holds** | Background job finds holds with no check-in | Auto-expire and release seat |
| **Duplicate seat assignments** | Daily audit job | Alert operations team; manual resolution |
| **Stale cache data** | Cache timestamp > 5 seconds | Invalidate cache; fetch from database |

---

## 10. Success Metrics & KPIs

### 10.1 Business Metrics

| Metric | Current | Target (6 months) | Measurement |
|--------|---------|-------------------|-------------|
| **Check-In Completion Rate** | 78% | 95% | Completed / Initiated |
| **Seat Conflict Incidents** | 12-15/day | 0/day | Support tickets |
| **Baggage Fee Capture** | 85% | 99% | Fees collected / Fees owed |
| **Customer Satisfaction (CSAT)** | 3.2/5 | 4.5/5 | Post-check-in survey |
| **Average Check-In Time** | 8 min | < 3 min | End-to-end flow time |

### 10.2 Technical Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **API Uptime** | 99.9% | < 99.5% |
| **P95 Response Time** | < 1s | > 2s |
| **Error Rate** | < 1% | > 5% |
| **Cache Hit Rate** | > 90% | < 80% |
| **Database CPU** | < 70% | > 85% |

### 10.3 User Experience Metrics

| Metric | Target | Tool |
|--------|--------|------|
| **Mobile App Crash Rate** | < 0.5% | Firebase Crashlytics |
| **Session Drop Rate** | < 5% | Google Analytics |
| **Average Seat Selection Time** | < 30 seconds | Custom instrumentation |

---

## 11. Risks & Mitigations

### 11.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Database deadlocks under load** | High | Medium | Implement retry logic; optimize query patterns; use distributed locks |
| **Cache inconsistency** | Medium | Medium | Use event-driven cache invalidation; reduce TTL to 5s |
| **Clock skew in distributed system** | High | Low | Use NTP sync; rely on database timestamps |

### 11.2 Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Revenue loss from payment failures** | High | Medium | Queue failed payments for retry; send email reminders |
| **Customer dissatisfaction from seat conflicts** | High | Low | Guarantee zero conflicts; provide instant alternatives |
| **Regulatory non-compliance (GDPR)** | Critical | Low | Implement data deletion API; audit data retention |

### 11.3 Operational Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Insufficient capacity during peak** | High | Medium | Auto-scaling; load testing before launch; capacity planning |
| **Lack of monitoring visibility** | Medium | High | Implement comprehensive observability stack; set up alerts |
| **Inadequate support tooling** | Medium | Medium | Build admin dashboard for staff overrides |

---

## 12. Dependencies & Integrations

### 12.1 External Services

| Service | Owner | Purpose | SLA | Fallback |
|---------|-------|---------|-----|----------|
| **Weight Service** | Operations Team | Baggage weight measurement | 99.5% | Manual entry |
| **Payment Service (Mock)** | SkyHigh Core Team | Simulate payment processing | N/A | N/A |
| **Notification Service** | IT Team | Push/email notifications | 99% | Email only |
| **Identity Service** | Security Team | Authentication (OAuth) | 99.9% | JWT fallback |

#### Mock Payment Service Specification

For development and testing purposes, a **Mock Payment Service** will be created within the SkyHigh Core project.

**Endpoints:**

1. **POST /api/mock-payment/initiate**
   - Input: `{ amount, passengerId, checkInId }`
   - Output: `{ paymentId, paymentUrl, expiresAt }`
   - Behavior: Generates a mock payment URL, stores payment request

2. **POST /api/mock-payment/confirm**
   - Input: `{ paymentId }`
   - Output: `{ status: "SUCCESS" | "FAILED", transactionId }`
   - Behavior: Simulates instant payment success (configurable for failure testing)

3. **GET /api/mock-payment/status/{paymentId}**
   - Output: `{ status: "PENDING" | "COMPLETED" | "FAILED", amount }`
   - Behavior: Returns current payment status

**Features:**
- Configurable success/failure rates for testing edge cases
- Simulated latency (0-5 seconds) for async payment scenarios
- Webhook callback to SkyHigh Core on payment completion
- In-memory storage (no database persistence needed)

**Usage Notes:**
- Mock service should be replaced with real payment gateway (Stripe/PayPal) in production
- Configuration flag to enable/disable mock mode: `PAYMENT_SERVICE_MODE=mock|production`

### 12.2 Internal Systems

| System | Integration Point | Data Flow |
|--------|-------------------|-----------|
| **Booking System** | Read passenger details | Booking ID → Passenger info |
| **Flight Operations** | Read flight schedules | Flight ID → Departure time |
| **Loyalty Program** | Read tier status | Passenger ID → Loyalty tier |
| **CRM System** | Write check-in events | Check-in complete → Customer profile |

---

## 13. Phased Rollout Plan

### Phase 1: MVP (Months 1-2)
**Scope:**
- Seat lifecycle management (AVAILABLE → HELD → CONFIRMED)
- Time-bound holds (120 seconds)
- Conflict-free seat assignment
- Basic seat map rendering

**Success Criteria:**
- Zero seat conflicts in pilot test (100 check-ins)
- P95 seat map load < 1s with 50 concurrent users

---

### Phase 2: Enhanced Features (Months 3-4)
**Scope:**
- Baggage validation & payment integration
- Check-in state management
- Cancellation flow
- Admin dashboard for staff overrides

**Success Criteria:**
- Baggage fee capture rate > 95%
- Check-in completion rate > 90%

---

### Phase 3: Scalability & Abuse Protection (Months 5-6)
**Scope:**
- Waitlist management
- Bot detection & rate limiting
- Performance optimization (caching, read replicas)
- Load testing for 500+ concurrent users

**Success Criteria:**
- System handles 500 concurrent users (P95 < 1s)
- Bot detection accuracy > 98%

---

### Phase 4: GA Release (Month 6+)
**Scope:**
- Full production rollout to all flights
- 24/7 monitoring & on-call rotation
- Post-launch optimization based on real traffic

**Success Criteria:**
- All business metrics meet targets
- System uptime > 99.9%

---

## 14. Open Questions & Assumptions

### 14.1 Open Questions

1. **Seat Hold for Groups:** If a family of 4 wants to sit together, should they hold 4 seats simultaneously? Or sequential holds?
   - **Decision:** ✅ **APPROVED** - Allow multi-seat holds with 120s timer for entire group

2. **Payment Gateway Integration:** Which payment provider (Stripe/PayPal/internal)?
   - **Decision:** ✅ **APPROVED** - Use mock payment service for development and testing

3. **Waitlist Notification Preferences:** Should passengers choose notification method (push vs email vs SMS)?
   - **Decision:** ✅ **APPROVED** - Default to push + email; allow opt-out

4. **Offline Mode:** Should app cache boarding pass for offline access?
   - **Decision:** ✅ **APPROVED** - Yes, required for poor airport connectivity

5. **Seat Upgrades:** If a premium seat becomes available, should system auto-offer to waitlisted passengers?
   - **Decision:** ❌ **NOT APPROVED** - Feature will not be implemented

### 14.2 Assumptions

1. **Passenger Authentication:** Assume existing OAuth service handles login
2. **Booking System Integration:** Assume booking ID uniquely identifies passenger
3. **Flight Schedule Data:** Assume flight departure times are accurate and updated
4. **Payment Processing:** Assume Payment Service is PCI DSS compliant
5. **Infrastructure:** Assume cloud hosting (AWS/Azure/GCP) with auto-scaling support
6. **Database Choice:** MongoDB for flexible document storage with transactions support
7. **Mobile App:** Assume native iOS/Android apps exist and can display countdown timers

---

## 15. Compliance & Regulatory

### 15.1 Data Privacy (GDPR/CCPA)

**Requirements:**
- Passenger PII encrypted at rest and in transit
- Data retention: 7 years for audit logs, 30 days for operational logs
- Right to deletion: Support data erasure requests within 30 days
- Data portability: Provide check-in history export

### 15.2 Accessibility (WCAG 2.1 AA)

**Requirements:**
- API responses include screen reader-friendly labels
- Seat map data structured for assistive technologies
- Time-based alerts (hold expiration) accessible via multiple channels

### 15.3 Financial Compliance (PCI DSS)

**Scope:**
- SkyHigh Core does NOT store payment card data
- Payment Service handles all PCI DSS requirements
- Baggage fee amounts and transaction IDs logged for audit

---

## 16. Glossary

| Term | Definition |
|------|------------|
| **Hold** | Temporary seat reservation (120 seconds) preventing others from selecting it |
| **Confirmed** | Permanent seat assignment linked to boarding pass |
| **Seat Map** | Visual representation of aircraft seats showing availability |
| **Baggage Fee** | Additional charge for bags exceeding 25kg weight limit |
| **Waitlist** | Queue of passengers waiting for a specific seat to become available |
| **Bot** | Automated script attempting to abuse seat availability checks |
| **Check-In Window** | Time period when check-in is allowed (24 hours to 2 hours before departure) |
| **P95 Latency** | 95th percentile response time (95% of requests faster than this) |

---

## 17. Appendices

### Appendix A: Database Schema (Draft)

#### MongoDB Collections

**Collection: seats**
```javascript
{
  _id: ObjectId("..."),
  seatId: "12A",                    // Unique seat identifier
  flightId: "SK123",                // Flight identifier
  rowNumber: 12,                    // Row number
  columnLetter: "A",                // Column letter
  seatType: "WINDOW",               // WINDOW | MIDDLE | AISLE
  state: "AVAILABLE",               // AVAILABLE | HELD | CONFIRMED | CANCELLED
  heldByPassengerId: null,          // Passenger ID holding the seat
  holdExpiresAt: null,              // ISODate timestamp for hold expiration
  confirmedByPassengerId: null,     // Passenger ID who confirmed the seat
  price: 25.00,                     // Seat selection price
  updatedAt: ISODate("2026-02-21T10:00:00Z")
}

// Indexes
db.seats.createIndex({ flightId: 1, state: 1 })           // Query by flight and state
db.seats.createIndex({ holdExpiresAt: 1 })                 // Background job for expiration
db.seats.createIndex({ seatId: 1, flightId: 1 }, { unique: true }) // Unique constraint

// Schema Validation
db.createCollection("seats", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["seatId", "flightId", "rowNumber", "columnLetter", "state"],
      properties: {
        seatId: { bsonType: "string", maxLength: 10 },
        flightId: { bsonType: "string", maxLength: 20 },
        rowNumber: { bsonType: "int", minimum: 1 },
        columnLetter: { bsonType: "string", maxLength: 1 },
        seatType: { enum: ["WINDOW", "MIDDLE", "AISLE"] },
        state: { enum: ["AVAILABLE", "HELD", "CONFIRMED", "CANCELLED"] },
        price: { bsonType: "double", minimum: 0 }
      }
    }
  }
})
```

**Collection: checkins**
```javascript
{
  _id: ObjectId("..."),
  checkInId: "C456",                // Unique check-in identifier
  passengerId: "P12345",            // Passenger identifier
  flightId: "SK123",                // Flight identifier
  seatId: "12A",                    // Selected seat
  state: "COMPLETED",               // NOT_STARTED | IN_PROGRESS | AWAITING_PAYMENT | COMPLETED | CANCELLED
  baggage: {
    count: 2,                       // Number of bags
    weights: [23.5, 26.2],          // Weight of each bag in kg
    fee: 50.00                      // Total baggage fee
  },
  paymentUrl: "https://...",        // Payment link for baggage fees
  createdAt: ISODate("2026-02-21T09:30:00Z"),
  completedAt: ISODate("2026-02-21T09:45:00Z")
}

// Indexes
db.checkins.createIndex({ passengerId: 1, flightId: 1 })  // Query by passenger and flight
db.checkins.createIndex({ checkInId: 1 }, { unique: true }) // Unique constraint
db.checkins.createIndex({ state: 1, createdAt: -1 })       // Query by state

// Schema Validation
db.createCollection("checkins", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["checkInId", "passengerId", "flightId", "state"],
      properties: {
        checkInId: { bsonType: "string", maxLength: 50 },
        passengerId: { bsonType: "string", maxLength: 50 },
        flightId: { bsonType: "string", maxLength: 20 },
        seatId: { bsonType: "string", maxLength: 10 },
        state: { enum: ["NOT_STARTED", "IN_PROGRESS", "AWAITING_PAYMENT", "COMPLETED", "CANCELLED"] }
      }
    }
  }
})
```

**Collection: waitlist**
```javascript
{
  _id: ObjectId("..."),
  waitlistId: "W999",               // Unique waitlist identifier
  passengerId: "P12345",            // Passenger identifier
  flightId: "SK123",                // Flight identifier
  seatId: "12A",                    // Requested seat
  priorityScore: 850,               // Priority score (loyalty tier + booking time)
  loyaltyTier: "GOLD",              // PLATINUM | GOLD | SILVER | REGULAR
  createdAt: ISODate("2026-02-21T08:00:00Z"),
  expiresAt: ISODate("2026-02-21T11:00:00Z")  // 3 hours before departure
}

// Indexes
db.waitlist.createIndex({ seatId: 1, priorityScore: -1 })  // Query by seat, sorted by priority
db.waitlist.createIndex({ waitlistId: 1 }, { unique: true }) // Unique constraint
db.waitlist.createIndex({ expiresAt: 1 })                   // Background job for cleanup

// Schema Validation
db.createCollection("waitlist", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["waitlistId", "passengerId", "flightId", "seatId", "priorityScore"],
      properties: {
        waitlistId: { bsonType: "string", maxLength: 50 },
        passengerId: { bsonType: "string", maxLength: 50 },
        flightId: { bsonType: "string", maxLength: 20 },
        seatId: { bsonType: "string", maxLength: 10 },
        priorityScore: { bsonType: "int", minimum: 0 },
        loyaltyTier: { enum: ["PLATINUM", "GOLD", "SILVER", "REGULAR"] }
      }
    }
  }
})
```

**Transaction Example (Seat Hold with Conflict Prevention):**
```javascript
// Use MongoDB multi-document transactions for atomicity
const session = client.startSession();
try {
  await session.withTransaction(async () => {
    // 1. Check if seat is available (with lock)
    const seat = await db.collection('seats').findOneAndUpdate(
      { 
        seatId: "12A", 
        flightId: "SK123", 
        state: "AVAILABLE" 
      },
      { 
        $set: { 
          state: "HELD",
          heldByPassengerId: "P12345",
          holdExpiresAt: new Date(Date.now() + 120000),  // 120 seconds
          updatedAt: new Date()
        }
      },
      { 
        returnDocument: 'after',
        session  // Use transaction session
      }
    );
    
    if (!seat.value) {
      throw new Error("SEAT_UNAVAILABLE");
    }
    
    // 2. Create check-in record
    await db.collection('checkins').insertOne({
      checkInId: "C456",
      passengerId: "P12345",
      flightId: "SK123",
      seatId: "12A",
      state: "IN_PROGRESS",
      createdAt: new Date()
    }, { session });
  });
} finally {
  await session.endSession();
}
```

### Appendix B: Load Testing Scenarios

**Scenario 1: Peak Check-In Rush**
- 500 concurrent users
- 80% browsing seat maps, 20% making reservations
- Duration: 30 minutes
- Expected: P95 < 1s, zero conflicts

**Scenario 2: Seat Conflict Stress Test**
- 100 users attempt to reserve same seat simultaneously
- Expected: Exactly 1 success, 99 failures with alternatives

**Scenario 3: Hold Expiration Under Load**
- 1000 holds created within 10 seconds
- Wait 120 seconds
- Expected: All 1000 seats return to AVAILABLE within 130 seconds

---

## Document Approval

| Role | Name | Approval Status | Date |
|------|------|-----------------|------|
| **Product Manager** | [Your Name] | Draft | 2026-02-21 |
| **Engineering Lead** | TBD | Pending | - |
| **Director of Operations** | TBD | Pending | - |
| **CTO** | TBD | Pending | - |

---

**Next Steps:**
1. Review and approve PRD with stakeholders
2. Create technical design document (TDD)
3. Set up project in Jira with epics/stories
4. Assign engineering team
5. Schedule kickoff meeting

**Document History:**
- v1.0 (2026-02-21): Initial draft created
