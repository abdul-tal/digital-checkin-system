# Workflow Design & Implementation

## Overview

This document details the implementation of the SkyHigh Digital Check-In System, including workflow diagrams, database schema, state transitions, and key design decisions.

---

## Table of Contents

1. [Primary Workflows](#primary-workflows)
2. [Database Schema](#database-schema)
3. [State Management](#state-management)
4. [API Workflows](#api-workflows)
5. [Concurrency Control](#concurrency-control)
6. [Event Flow](#event-flow)
7. [Business Rules](#business-rules)

---

## Primary Workflows

### 1. Simple Check-In Flow (No Baggage/Underweight)

```
┌─────────┐         ┌─────────────┐         ┌──────────────┐
│  Client │         │ API Gateway │         │Check-In Svc  │
└────┬────┘         └──────┬──────┘         └──────┬───────┘
     │                     │                        │
     │  POST /checkin/start                         │
     ├────────────────────>│                        │
     │                     │  Forward + Auth        │
     │                     ├───────────────────────>│
     │                     │                        │
     │                     │                   ┌────▼────┐
     │                     │                   │ Create  │
     │                     │                   │Check-In │
     │                     │                   │ Session │
     │                     │                   └────┬────┘
     │                     │  checkInId, state=     │
     │                     │    IN_PROGRESS         │
     │                     │<───────────────────────┤
     │  checkInId          │                        │
     │<────────────────────┤                        │
     │                     │                        │
     │ POST /checkin/complete                       │
     │  {seatId, baggage}  │                        │
     ├────────────────────>│                        │
     │                     │  Forward               │
     │                     ├───────────────────────>│
     │                     │                        │
     │                     │                   ┌────▼─────────┐
     │                     │                   │1. Hold Seat  │
     │                     │                   │   (Seat Svc) │
     │                     │                   └────┬─────────┘
     │                     │                        │
     │                     │                   ┌────▼─────────┐
     │                     │                   │2. Weigh Bags │
     │                     │                   │  (Weight Svc)│
     │                     │                   └────┬─────────┘
     │                     │                        │
     │                     │                   ┌────▼─────────┐
     │                     │                   │3. Validate   │
     │                     │                   │   (<25kg OK) │
     │                     │                   └────┬─────────┘
     │                     │                        │
     │                     │                   ┌────▼─────────┐
     │                     │                   │4. Confirm    │
     │                     │                   │   Seat       │
     │                     │                   └────┬─────────┘
     │                     │                        │
     │                     │                   ┌────▼─────────┐
     │                     │                   │5. Generate   │
     │                     │                   │   Boarding   │
     │                     │                   │   Pass       │
     │                     │                   └────┬─────────┘
     │                     │                        │
     │                     │  {state: COMPLETED,    │
     │                     │   boardingPass}        │
     │                     │<───────────────────────┤
     │  Boarding Pass + QR │                        │
     │<────────────────────┤                        │
     └─────────────────────┘                        └
```

**Steps**:
1. Client initiates check-in (`POST /checkin/start`)
2. Check-In Service creates session with `IN_PROGRESS` state
3. Client selects seat and provides baggage info
4. Check-In Service orchestrates:
   - Holds seat in Seat Service
   - Weighs bags via Weight Service
   - Validates weight (<25kg passes)
   - Confirms seat reservation
   - Generates boarding pass with QR code
5. Returns `COMPLETED` check-in with boarding pass

---

### 2. Overweight Baggage Flow (Payment Required)

```
┌─────────┐         ┌─────────────┐         ┌──────────────┐        ┌────────────┐
│  Client │         │ API Gateway │         │Check-In Svc  │        │Payment Svc │
└────┬────┘         └──────┬──────┘         └──────┬───────┘        └──────┬─────┘
     │                     │                        │                       │
     │ POST /checkin/complete                       │                       │
     │  {seatId, baggage: 2 bags}                   │                       │
     ├────────────────────>│                        │                       │
     │                     ├───────────────────────>│                       │
     │                     │                        │                       │
     │                     │                   ┌────▼─────────┐             │
     │                     │                   │1. Hold Seat  │             │
     │                     │                   └────┬─────────┘             │
     │                     │                        │                       │
     │                     │                   ┌────▼─────────┐             │
     │                     │                   │2. Weigh Bags │             │
     │                     │                   │   [20kg, 30kg]             │
     │                     │                   └────┬─────────┘             │
     │                     │                        │                       │
     │                     │                   ┌────▼─────────┐             │
     │                     │                   │3. Validate   │             │
     │                     │                   │   30kg > 25kg│             │
     │                     │                   │   Fee: $100  │             │
     │                     │                   └────┬─────────┘             │
     │                     │                        │                       │
     │                     │                        │  Create Payment       │
     │                     │                        ├──────────────────────>│
     │                     │                        │                       │
     │                     │                        │  {paymentId,          │
     │                     │                        │   paymentUrl}         │
     │                     │                        │<──────────────────────┤
     │                     │                        │                       │
     │                     │  {state: AWAITING_     │                       │
     │                     │   PAYMENT,             │                       │
     │                     │   paymentUrl,          │                       │
     │                     │   baggageFee: 100}     │                       │
     │                     │<───────────────────────┤                       │
     │  Payment Required   │                        │                       │
     │  + Payment Link     │                        │                       │
     │<────────────────────┤                        │                       │
     │                     │                        │                       │
     │ POST /payments/{id}/confirm                  │                       │
     ├────────────────────>│                        │                       │
     │                     ├───────────────────────────────────────────────>│
     │                     │                        │                       │
     │                     │                        │                  ┌────▼─────┐
     │                     │                        │                  │ Confirm  │
     │                     │                        │                  │ Payment  │
     │                     │                        │                  └────┬─────┘
     │                     │                        │                       │
     │                     │                        │    Publish:           │
     │                     │                        │    payment.confirmed  │
     │                     │                        │<──────────────────────┤
     │                     │  {status: COMPLETED}   │                       │
     │                     │<───────────────────────────────────────────────┤
     │  Payment Confirmed  │                        │                       │
     │<────────────────────┤                        │                       │
     │                     │                        │                       │
     │                     │                   ┌────▼─────────┐             │
     │                     │                   │ Event:       │             │
     │                     │                   │ payment.     │             │
     │                     │                   │ confirmed    │             │
     │                     │                   └────┬─────────┘             │
     │                     │                        │                       │
     │                     │                   ┌────▼─────────┐             │
     │                     │                   │1. Confirm    │             │
     │                     │                   │   Seat       │             │
     │                     │                   └────┬─────────┘             │
     │                     │                        │                       │
     │                     │                   ┌────▼─────────┐             │
     │                     │                   │2. Generate   │             │
     │                     │                   │   Boarding   │             │
     │                     │                   │   Pass       │             │
     │                     │                   └────┬─────────┘             │
     │                     │                        │                       │
     │                     │                   ┌────▼─────────┐             │
     │                     │                   │3. Update     │             │
     │                     │                   │   State:     │             │
     │                     │                   │   COMPLETED  │             │
     │                     │                   └──────────────┘             │
     │                     │                        │                       │
     │ GET /checkin/{id}   │                        │                       │
     ├────────────────────>│                        │                       │
     │                     ├───────────────────────>│                       │
     │                     │  {state: COMPLETED,    │                       │
     │                     │   boardingPass}        │                       │
     │                     │<───────────────────────┤                       │
     │  Boarding Pass      │                        │                       │
     │<────────────────────┤                        │                       │
     └─────────────────────┘                        └                       └
```

**Steps**:
1. Baggage validation fails (>25kg)
2. System calculates fee ($100 per overweight bag)
3. Creates payment intent in Payment Service
4. Returns `AWAITING_PAYMENT` state with payment URL
5. Seat remains `HELD` during payment window
6. Client confirms payment
7. Payment Service publishes `payment.confirmed` event
8. Check-In Service subscribes to event
9. Automatically confirms seat and generates boarding pass
10. Check-In state updates to `COMPLETED`

---

### 3. Waitlist Flow with Auto-Completion

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────┐
│  UserE  │    │ Check-In Svc │    │Waitlist Svc  │    │  Seat Svc    │    │Notify Svc  │
└────┬────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬─────┘
     │                │                    │                    │                    │
     │ 1. Start Check-In                  │                    │                    │
     ├───────────────>│                    │                    │                    │
     │                │                    │                    │                    │
     │ checkInId:     │                    │                    │                    │
     │ "ci_12345"     │                    │                    │                    │
     │<───────────────┤                    │                    │                    │
     │                │                    │                    │                    │
     │ 2. Join Waitlist                    │                    │                    │
     │    {checkInId, seatId, baggage}     │                    │                    │
     ├────────────────────────────────────>│                    │                    │
     │                │                    │                    │                    │
     │                │               ┌────▼──────┐             │                    │
     │                │               │ Calculate │             │                    │
     │                │               │ Priority  │             │                    │
     │                │               │ (Loyalty+ │             │                    │
     │                │               │ Booking+  │             │                    │
     │                │               │ Special)  │             │                    │
     │                │               └────┬──────┘             │                    │
     │                │                    │                    │                    │
     │                │               ┌────▼──────┐             │                    │
     │                │               │   Store   │             │                    │
     │                │               │  Waitlist │             │                    │
     │                │               │   Entry   │             │                    │
     │                │               └────┬──────┘             │                    │
     │                │                    │                    │                    │
     │  {waitlistId,  │                    │                    │                    │
     │   position: 1, │                    │                    │                    │
     │   priority: 120}                    │                    │                    │
     │<────────────────────────────────────┤                    │                    │
     │                │                    │                    │                    │
     │                │                    │                    │                    │
     │                │                    │    Event:          │                    │
     │                │                    │    seat.hold.      │                    │
     │                │                    │    expired         │                    │
     │                │                    │    {seatId: "15E"} │                    │
     │                │                    │<───────────────────┤                    │
     │                │                    │                    │                    │
     │                │               ┌────▼──────┐             │                    │
     │                │               │  Find Top │             │                    │
     │                │               │  Priority │             │                    │
     │                │               │  Waitlist │             │                    │
     │                │               │   for 15E │             │                    │
     │                │               └────┬──────┘             │                    │
     │                │                    │                    │                    │
     │                │                    │  Auto-Complete     │                    │
     │                │                    │  Check-In:         │                    │
     │                │                    │  {checkInId,       │                    │
     │                │                    │   seatId,          │                    │
     │                │                    │   baggage}         │                    │
     │                │                    ├───────────────────>│                    │
     │                │<───────────────────┤                    │                    │
     │                │                    │                    │                    │
     │                │               ┌────▼──────┐             │                    │
     │                │               │1. Hold    │             │                    │
     │                │               │   Seat    │             │                    │
     │                │               │2. Validate│             │                    │
     │                │               │   Baggage │             │                    │
     │                │               │3. Confirm │             │                    │
     │                │               │   Seat    │             │                    │
     │                │               │4. Generate│             │                    │
     │                │               │   Pass    │             │                    │
     │                │               └────┬──────┘             │                    │
     │                │                    │                    │                    │
     │                │                    │  Publish:          │                    │
     │                │                    │  waitlist.checkin. │                    │
     │                │                    │  completed         │                    │
     │                │                    ├───────────────────────────────────────>│
     │                │                    │                    │                    │
     │                │                    │                    │               ┌────▼────┐
     │                │                    │                    │               │  Send   │
     │                │                    │                    │               │  Push   │
     │                │                    │                    │               │  Email  │
     │                │                    │                    │               │  SMS    │
     │                │                    │                    │               └─────────┘
     │                │                    │                    │                    │
     │ 📱 PUSH: "Your seat 15E is confirmed! Check-in complete."                     │
     │<───────────────────────────────────────────────────────────────────────────────┤
     │                │                    │                    │                    │
     │ 3. Get Check-In Status              │                    │                    │
     ├───────────────>│                    │                    │                    │
     │                │                    │                    │                    │
     │  {state:       │                    │                    │                    │
     │   COMPLETED,   │                    │                    │                    │
     │   seatId: "15E"│                    │                    │                    │
     │   boardingPass}│                    │                    │                    │
     │<───────────────┤                    │                    │                    │
     └────────────────┘                    └                    └                    └
```

**Key Features**:
1. Passenger starts check-in and receives `checkInId`
2. Joins waitlist with stored check-in context and baggage info
3. System stores waitlist entry with priority calculation
4. When seat becomes available (hold expiry/cancellation):
   - Waitlist Service automatically calls Check-In Service
   - Completes entire check-in workflow
   - Generates boarding pass
5. Passenger receives notification with boarding pass
6. Zero manual intervention after joining waitlist

---

### 4. Seat Hold Expiration Flow

```
┌────────────────┐         ┌──────────────┐         ┌────────────────┐
│Hold Expiration │         │  Seat Svc    │         │ Check-In Svc   │
│     Job        │         │              │         │                │
│(Runs every 5s) │         │              │         │                │
└───────┬────────┘         └──────┬───────┘         └────────┬───────┘
        │                         │                          │
   ┌────▼────────┐                │                          │
   │ Find HELD   │                │                          │
   │ Seats where │                │                          │
   │ holdExpiresAt               │                          │
   │  < NOW()    │                │                          │
   └────┬────────┘                │                          │
        │                         │                          │
   ┌────▼────────┐                │                          │
   │ For Each    │                │                          │
   │ Expired Seat│                │                          │
   └────┬────────┘                │                          │
        │                         │                          │
        │  Check if seat linked   │                          │
        │  to AWAITING_PAYMENT    │                          │
        │  check-in               │                          │
        ├────────────────────────>│                          │
        │                         │                          │
        │                    ┌────▼─────────┐                │
        │                    │ Query        │                │
        │                    │ CheckIn for  │                │
        │                    │ {seatId,     │                │
        │                    │  state:      │                │
        │                    │  AWAITING_   │                │
        │                    │  PAYMENT}    │                │
        │                    └────┬─────────┘                │
        │                         │                          │
        │                         │                          │
   ┌────▼────────┐                │                          │
   │ If payment  │                │                          │
   │ pending:    │                │                          │
   │ EXTEND HOLD │                │                          │
   │ (30 min)    │                │                          │
   └────┬────────┘                │                          │
        │                         │                          │
        │  Update holdExpiresAt   │                          │
        │  to payment expiry      │                          │
        ├────────────────────────>│                          │
        │                         │                          │
        │  SKIP RELEASE           │                          │
        │                         │                          │
        │                         │                          │
   ┌────▼────────┐                │                          │
   │ If NO       │                │                          │
   │ payment:    │                │                          │
   │ RELEASE     │                │                          │
   └────┬────────┘                │                          │
        │                         │                          │
        │  Release seat           │                          │
        │  (state: AVAILABLE)     │                          │
        ├────────────────────────>│                          │
        │                         │                          │
        │                    ┌────▼─────────┐                │
        │                    │ Update       │                │
        │                    │ state:       │                │
        │                    │ AVAILABLE    │                │
        │                    │ holdExpiry:  │                │
        │                    │ null         │                │
        │                    └────┬─────────┘                │
        │                         │                          │
        │                         │  Publish:                │
        │                         │  seat.hold.expired       │
        │                         ├─────────────────────────>│
        │                         │                          │
        │                         │  Publish to Waitlist Svc │
        │                         │  (via Redis Pub/Sub)     │
        │                         │                          │
        └─────────────────────────┘                          └
```

**Protection Logic**:
- Prevents premature seat release during payment processing
- Extends hold duration to match payment window
- Only releases seats with no active payment
- Critical for payment flow integrity

---

## Database Schema

### MongoDB Collections

#### 1. Seats Collection

```javascript
{
  _id: ObjectId("..."),
  seatId: "12A",                    // Unique seat identifier
  flightId: "SK123",                // Flight identifier
  row: 12,                          // Row number
  column: "A",                      // Column letter
  state: "AVAILABLE",               // AVAILABLE | HELD | CONFIRMED | CANCELLED
  type: "WINDOW",                   // WINDOW | MIDDLE | AISLE
  price: 25,                        // Base price in USD
  isEmergencyExit: false,           // Emergency exit flag
  heldByPassengerId: null,          // Passenger ID if HELD
  confirmedByPassengerId: null,     // Passenger ID if CONFIRMED
  holdExpiresAt: null,              // Expiry timestamp for HELD state
  stateHistory: [                   // State transition history
    {
      state: "AVAILABLE",
      timestamp: ISODate("2026-02-22T10:00:00Z"),
      triggeredBy: "SYSTEM_INIT"
    },
    {
      state: "HELD",
      timestamp: ISODate("2026-02-22T10:15:30Z"),
      triggeredBy: "P_12345",
      metadata: {
        checkInId: "ci_abc123",
        holdDuration: 20
      }
    }
  ],
  createdAt: ISODate("2026-02-22T10:00:00Z"),
  updatedAt: ISODate("2026-02-22T10:15:30Z")
}

// Indexes
{
  "seatId": 1,
  "flightId": 1
}  // Unique compound index

{
  "flightId": 1,
  "state": 1
}  // Query optimization for seat maps

{
  "state": 1,
  "holdExpiresAt": 1
}  // Expiration job optimization
```

#### 2. CheckIns Collection

```javascript
{
  _id: ObjectId("..."),
  checkInId: "ci_abc123",           // Unique check-in identifier
  passengerId: "P_12345",           // Passenger identifier
  userId: "U_12345",                // User identifier
  bookingId: "BK_001",              // Booking reference
  flightId: "SK123",                // Flight identifier
  seatId: "12A",                    // Selected seat
  state: "COMPLETED",               // IN_PROGRESS | AWAITING_PAYMENT | COMPLETED | CANCELLED
  baggage: {
    count: 2,                       // Number of bags
    weights: [20, 18],              // Individual bag weights
    totalWeight: 38,                // Total weight
    isOverweight: false,            // Flag for >25kg bags
    fee: 0                          // Additional fee
  },
  paymentId: null,                  // Payment ID if fee required
  boardingPass: {
    passengerId: "P_12345",
    flightId: "SK123",
    seatNumber: "12A",
    boardingGroup: "B",
    qrCode: "data:image/png;base64,..."
  },
  stateHistory: [                   // State transition history
    {
      state: "IN_PROGRESS",
      timestamp: ISODate("2026-02-22T10:15:00Z"),
      triggeredBy: "USER",
      metadata: {
        initiatedBy: "P_12345"
      }
    },
    {
      state: "COMPLETED",
      timestamp: ISODate("2026-02-22T10:16:45Z"),
      triggeredBy: "SYSTEM",
      metadata: {
        baggageValidated: true,
        seatConfirmed: true,
        boardingPassGenerated: true
      }
    }
  ],
  createdAt: ISODate("2026-02-22T10:15:00Z"),
  updatedAt: ISODate("2026-02-22T10:16:45Z"),
  completedAt: ISODate("2026-02-22T10:16:45Z")
}

// Indexes
{
  "checkInId": 1
}  // Unique

{
  "passengerId": 1,
  "flightId": 1
}  // Query by passenger

{
  "seatId": 1,
  "flightId": 1
}  // Query by seat

{
  "state": 1
}  // State filtering
```

#### 3. Payments Collection

```javascript
{
  _id: ObjectId("..."),
  paymentId: "pay_xyz789",          // Unique payment identifier
  checkInId: "ci_abc123",           // Associated check-in
  passengerId: "P_12345",           // Passenger identifier
  amount: 100,                      // Amount in USD
  currency: "USD",                  // Currency code
  status: "COMPLETED",              // PENDING | COMPLETED | FAILED
  paymentUrl: "https://mock.pay/...", // Mock payment URL
  metadata: {
    reason: "OVERWEIGHT_BAGGAGE",
    bagWeights: [30, 22],
    excessWeight: 5
  },
  stateHistory: [
    {
      state: "PENDING",
      timestamp: ISODate("2026-02-22T10:16:00Z")
    },
    {
      state: "COMPLETED",
      timestamp: ISODate("2026-02-22T10:18:30Z"),
      metadata: {
        paymentMethod: "CREDIT_CARD",
        transactionId: "txn_mock_123"
      }
    }
  ],
  createdAt: ISODate("2026-02-22T10:16:00Z"),
  updatedAt: ISODate("2026-02-22T10:18:30Z"),
  completedAt: ISODate("2026-02-22T10:18:30Z")
}

// Indexes
{
  "paymentId": 1
}  // Unique

{
  "checkInId": 1
}  // Link to check-in

{
  "status": 1
}  // Status filtering
```

#### 4. Waitlists Collection

```javascript
{
  _id: ObjectId("..."),
  waitlistId: "wl_def456",          // Unique waitlist identifier
  passengerId: "P_67890",           // Passenger identifier
  checkInId: "ci_xyz789",           // Associated check-in session
  userId: "U_67890",                // User identifier
  flightId: "SK123",                // Flight identifier
  seatId: "15E",                    // Desired seat
  priorityScore: 120,               // Calculated priority
  loyaltyTier: "GOLD",              // GOLD | SILVER | BRONZE
  bookingTimestamp: ISODate("2026-02-20T08:00:00Z"),
  hasSpecialNeeds: false,           // Special needs flag
  baggage: {
    count: 1,
    weights: [18]                   // Stored for auto-completion
  },
  status: "ACTIVE",                 // ACTIVE | ASSIGNED | EXPIRED
  assignedAt: null,                 // Assignment timestamp
  stateHistory: [
    {
      state: "ACTIVE",
      timestamp: ISODate("2026-02-22T10:20:00Z"),
      metadata: {
        position: 1,
        estimatedWaitTime: "15 minutes"
      }
    }
  ],
  createdAt: ISODate("2026-02-22T10:20:00Z"),
  updatedAt: ISODate("2026-02-22T10:20:00Z")
}

// Indexes
{
  "waitlistId": 1
}  // Unique

{
  "flightId": 1,
  "seatId": 1,
  "priorityScore": -1,
  "status": 1
}  // Priority queue

{
  "passengerId": 1,
  "flightId": 1
}  // Passenger waitlists
```

#### 5. AuditLogs Collection

```javascript
{
  _id: ObjectId("..."),
  userId: "U_attacker",             // User identifier
  ip: "192.168.1.100",              // IP address
  action: "SEAT_MAP_ACCESS",        // Action type
  pattern: "RAPID_ACCESS",          // RAPID_ACCESS | HOLD_SPAM
  severity: "HIGH",                 // LOW | MEDIUM | HIGH | CRITICAL
  details: {
    accessCount: 52,
    timeWindow: 2,                  // seconds
    threshold: 50
  },
  blocked: true,                    // Blocking flag
  blockedUntil: ISODate("2026-02-22T10:30:00Z"),
  timestamp: ISODate("2026-02-22T10:25:00Z")
}

// Indexes
{
  "userId": 1,
  "timestamp": -1
}

{
  "ip": 1,
  "timestamp": -1
}

{
  "blocked": 1,
  "blockedUntil": 1
}
```

---

### Database Relationships

```
┌─────────────┐
│   Seats     │
│             │
│ seatId (PK) │◄────────┐
│ flightId    │         │
│ state       │         │
│ heldBy      │         │
└─────────────┘         │
                        │
                        │ 1:1
                        │
┌─────────────┐         │
│  CheckIns   │         │
│             │         │
│ checkInId(PK)         │
│ seatId (FK) ├─────────┘
│ passengerId │
│ paymentId   ├─────────┐
│ state       │         │
└─────────────┘         │
                        │ 1:1
                        │
┌─────────────┐         │
│  Payments   │         │
│             │         │
│ paymentId(PK)◄────────┘
│ checkInId(FK)
│ status      │
└─────────────┘


┌─────────────┐
│  CheckIns   │
│             │
│ checkInId(PK)◄────────┐
│ passengerId │         │
└─────────────┘         │
                        │ 1:1
                        │
┌─────────────┐         │
│ Waitlists   │         │
│             │         │
│ waitlistId(PK)        │
│ checkInId(FK)─────────┘
│ seatId      │
│ priority    │
└─────────────┘


┌─────────────┐
│  AuditLogs  │
│             │
│ userId      │◄──── Many audit entries
│ action      │      per user
│ pattern     │
└─────────────┘
```

---

## State Management

### Seat State Machine

```
                    ┌──────────────┐
                    │  AVAILABLE   │
                    └──────┬───────┘
                           │
                    holdSeat() with
                    passengerId +
                    expiry time
                           │
                           ▼
                    ┌──────────────┐
          ┌─────────┤     HELD     │
          │         └──────┬───────┘
          │                │
    releaseSeat()   confirmSeat()
    (manual or      with matching
     timeout)       passengerId
          │                │
          │                ▼
          │         ┌──────────────┐
          │         │  CONFIRMED   │
          │         └──────┬───────┘
          │                │
          │         cancelCheckIn()
          │                │
          │                ▼
          └────────>┌──────────────┐
                    │  AVAILABLE   │
                    └──────────────┘
```

**Transitions**:
1. `AVAILABLE → HELD`: User initiates seat selection
   - Sets `heldByPassengerId`
   - Sets `holdExpiresAt` (20 seconds default)
   - Atomic operation with condition: `state === AVAILABLE`

2. `HELD → CONFIRMED`: Payment completed or no baggage fee
   - Sets `confirmedByPassengerId`
   - Clears `holdExpiresAt`
   - Publishes `seat.confirmed` event

3. `HELD → AVAILABLE`: Hold expires or manual release
   - Clears `heldByPassengerId` and `holdExpiresAt`
   - Publishes `seat.hold.expired` or `seat.released` event

4. `CONFIRMED → AVAILABLE`: Check-in cancelled
   - Clears `confirmedByPassengerId`
   - Publishes `seat.released` event

---

### Check-In State Machine

```
        ┌────────────────┐
        │  IN_PROGRESS   │
        └────────┬───────┘
                 │
          ┌──────┴──────┐
          │             │
   Baggage OK      Baggage
   (<25kg)         Overweight
          │             │
          ▼             ▼
   ┌──────────┐  ┌──────────────┐
   │COMPLETED │  │AWAITING_      │
   │          │  │PAYMENT        │
   └──────────┘  └──────┬───────┘
                        │
                 Payment Confirmed
                        │
                        ▼
                 ┌──────────────┐
                 │  COMPLETED   │
                 └──────────────┘
```

**States**:
- `IN_PROGRESS`: Initial state after start
- `AWAITING_PAYMENT`: Baggage fee required
- `COMPLETED`: Boarding pass generated
- `CANCELLED`: User cancelled (not shown in diagram)

---

### Payment State Machine

```
   ┌──────────┐
   │ PENDING  │
   └────┬─────┘
        │
   ┌────┴────┐
   │         │
Confirm   Timeout/Fail
   │         │
   ▼         ▼
┌─────────┐ ┌─────────┐
│COMPLETED│ │ FAILED  │
└─────────┘ └─────────┘
```

---

## API Workflows

### Authentication Flow

```
POST /auth/login
Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "U_12345",
    "email": "user@example.com",
    "role": "passenger",
    "loyaltyTier": "GOLD",
    "permissions": ["book:seat", "cancel:checkin", "join:waitlist"]
  }
}

Token Payload:
{
  "userId": "U_12345",
  "role": "passenger",
  "loyaltyTier": "GOLD",
  "permissions": ["book:seat", "cancel:checkin", "join:waitlist"],
  "iat": 1771795214,
  "exp": 1771881614,
  "aud": "skyhigh-api",
  "iss": "skyhigh-core"
}
```

---

### Seat Map Retrieval

```
GET /api/v1/flights/{flightId}/seatmap
Headers:
  Authorization: Bearer <token>

Response:
{
  "flightId": "SK123",
  "aircraft": "Boeing 737",
  "totalSeats": 180,
  "availableSeats": 175,
  "seats": [
    {
      "seatId": "1A",
      "row": 1,
      "column": "A",
      "state": "AVAILABLE",
      "type": "WINDOW",
      "price": 50
    },
    {
      "seatId": "12A",
      "row": 12,
      "column": "A",
      "state": "HELD",
      "type": "WINDOW",
      "price": 25,
      "heldByPassengerId": "P_12345",
      "holdExpiresAt": "2026-02-22T10:15:50Z"
    },
    // ... 178 more seats
  ]
}
```

---

### Check-In Workflow APIs

**1. Start Check-In**
```
POST /api/v1/checkin/start
Headers:
  Authorization: Bearer <token>

Request:
{
  "passengerId": "P_12345",
  "userId": "U_12345",
  "bookingId": "BK_001"
}

Response:
{
  "checkInId": "ci_abc123",
  "passengerId": "P_12345",
  "flightId": "SK123",
  "state": "IN_PROGRESS",
  "createdAt": "2026-02-22T10:15:00Z"
}
```

**2. Complete Check-In**
```
POST /api/v1/checkin/complete
Headers:
  Authorization: Bearer <token>

Request:
{
  "checkInId": "ci_abc123",
  "passengerId": "P_12345",
  "userId": "U_12345",
  "seatId": "12A",
  "baggage": {
    "count": 2,
    "weights": [20, 18]  // Optional: for deterministic testing
  }
}

Response (No Fee):
{
  "checkInId": "ci_abc123",
  "state": "COMPLETED",
  "seatId": "12A",
  "boardingPass": {
    "passengerId": "P_12345",
    "flightId": "SK123",
    "seatNumber": "12A",
    "boardingGroup": "B",
    "qrCode": "data:image/png;base64,..."
  }
}

Response (Fee Required):
{
  "checkInId": "ci_abc123",
  "state": "AWAITING_PAYMENT",
  "seatId": "12A",
  "baggageFee": 100,
  "paymentUrl": "https://mock.pay/pay_xyz789",
  "paymentId": "pay_xyz789",
  "expiresAt": "2026-02-22T10:46:00Z"
}
```

**3. Get Check-In Status**
```
GET /api/v1/checkin/{checkInId}
Headers:
  Authorization: Bearer <token>

Response:
{
  "checkInId": "ci_abc123",
  "passengerId": "P_12345",
  "flightId": "SK123",
  "seatId": "12A",
  "state": "COMPLETED",
  "boardingPass": {
    "passengerId": "P_12345",
    "flightId": "SK123",
    "seatNumber": "12A",
    "boardingGroup": "B",
    "qrCode": "data:image/png;base64,..."
  },
  "completedAt": "2026-02-22T10:16:45Z"
}
```

**4. Cancel Check-In**
```
POST /api/v1/checkin/{checkInId}/cancel
Headers:
  Authorization: Bearer <token>

Request:
{
  "passengerId": "P_12345"
}

Response:
{
  "checkInId": "ci_abc123",
  "state": "CANCELLED",
  "seatId": "12A",
  "seatReleased": true,
  "cancelledAt": "2026-02-22T10:20:00Z"
}
```

---

### Waitlist APIs

**1. Join Waitlist**
```
POST /api/v1/waitlist/join
Headers:
  Authorization: Bearer <token>

Request:
{
  "passengerId": "P_67890",
  "checkInId": "ci_xyz789",
  "userId": "U_67890",
  "flightId": "SK123",
  "seatId": "15E",
  "loyaltyTier": "GOLD",
  "bookingTimestamp": "2026-02-20T08:00:00Z",
  "hasSpecialNeeds": false,
  "baggage": {
    "count": 1,
    "weights": [18]
  }
}

Response:
{
  "waitlistId": "wl_def456",
  "position": 1,
  "priority": 120,
  "estimatedWaitTime": "15 minutes"
}
```

**2. Leave Waitlist**
```
POST /api/v1/waitlist/{waitlistId}/leave
Headers:
  Authorization: Bearer <token>

Request:
{
  "passengerId": "P_67890"
}

Response:
{
  "waitlistId": "wl_def456",
  "status": "REMOVED",
  "removedAt": "2026-02-22T10:25:00Z"
}
```

---

## Concurrency Control

### Atomic Seat Operations

**MongoDB Transaction Pattern**:
```javascript
// Hold Seat with Concurrency Protection
async function holdSeat(seatId, flightId, passengerId) {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Atomic update with condition
      const seat = await Seat.findOneAndUpdate(
        {
          seatId,
          flightId,
          state: 'AVAILABLE'  // CRITICAL: Only if AVAILABLE
        },
        {
          $set: {
            state: 'HELD',
            heldByPassengerId: passengerId,
            holdExpiresAt: new Date(Date.now() + 20000),
            updatedAt: new Date()
          },
          $push: {
            stateHistory: {
              state: 'HELD',
              timestamp: new Date(),
              triggeredBy: passengerId
            }
          }
        },
        {
          returnDocument: 'after',
          session  // Part of transaction
        }
      );
      
      if (!seat) {
        throw new Error('Seat not available');
      }
      
      return seat;
    });
  } finally {
    await session.endSession();
  }
}
```

**Race Condition Prevention**:
1. Conditional update ensures only `AVAILABLE` seats can be held
2. MongoDB's atomic `findOneAndUpdate` prevents double-booking
3. Transaction ensures rollback on any failure
4. Unique compound index on `(seatId, flightId)` prevents duplicates

---

### Optimistic Locking Pattern

```javascript
// Version-based optimistic locking
const seat = await Seat.findOne({ seatId, flightId });

const updated = await Seat.findOneAndUpdate(
  {
    seatId,
    flightId,
    __v: seat.__v  // Check version hasn't changed
  },
  {
    $set: { state: 'CONFIRMED' },
    $inc: { __v: 1 }  // Increment version
  }
);

if (!updated) {
  throw new ConcurrencyError('Seat modified by another transaction');
}
```

---

## Event Flow

### Redis Pub/Sub Events

**Event Format**:
```javascript
{
  channel: "seat.confirmed",
  payload: {
    seatId: "12A",
    flightId: "SK123",
    passengerId: "P_12345",
    timestamp: "2026-02-22T10:16:45Z",
    metadata: {
      checkInId: "ci_abc123"
    }
  }
}
```

**Event Channels**:
1. `seat.confirmed`: Seat confirmation completed
2. `seat.released`: Seat released from hold/confirmation
3. `seat.hold.expired`: Hold expired naturally
4. `payment.confirmed`: Payment successfully processed
5. `waitlist.assigned`: Seat assigned to waitlisted passenger
6. `waitlist.checkin.completed`: Waitlist auto-completion finished

---

### Event Flow Diagram

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Seat Svc    │         │  Redis       │         │ Waitlist Svc │
└──────┬───────┘         │  Pub/Sub     │         └──────┬───────┘
       │                 └──────┬───────┘                │
       │                        │                        │
  Seat Hold                     │                        │
  Expires                       │                        │
       │                        │                        │
       │  PUBLISH:              │                        │
       │  seat.hold.expired     │                        │
       ├───────────────────────>│                        │
       │                        │                        │
       │                        │  DELIVER EVENT         │
       │                        ├───────────────────────>│
       │                        │                        │
       │                        │                   ┌────▼────┐
       │                        │                   │ Process │
       │                        │                   │Waitlist │
       │                        │                   └────┬────┘
       │                        │                        │
       │                        │   Call Check-In Svc    │
       │                        │   to Auto-Complete     │
       │                        │                        │


┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ Payment Svc  │         │  Redis       │         │ CheckIn Svc  │
└──────┬───────┘         │  Pub/Sub     │         └──────┬───────┘
       │                 └──────┬───────┘                │
       │                        │                        │
  Payment                       │                        │
  Confirmed                     │                        │
       │                        │                        │
       │  PUBLISH:              │                        │
       │  payment.confirmed     │                        │
       ├───────────────────────>│                        │
       │                        │                        │
       │                        │  DELIVER EVENT         │
       │                        ├───────────────────────>│
       │                        │                        │
       │                        │                   ┌────▼────┐
       │                        │                   │ Confirm │
       │                        │                   │  Seat   │
       │                        │                   │Generate │
       │                        │                   │  Pass   │
       │                        │                   └─────────┘
```

---

## Business Rules

### Baggage Weight Rules

1. **Standard Limit**: 25kg per bag
2. **Absolute Maximum**: 32kg per bag
3. **Fee Calculation**: $100 per bag exceeding 25kg
4. **Payment Window**: 30 minutes to complete payment
5. **Seat Hold During Payment**: Extended to match payment expiry

### Seat Hold Rules

1. **Hold Duration**: 20 seconds (configurable via `SEAT_HOLD_DURATION_SECONDS`)
2. **Automatic Release**: Background job runs every 5 seconds
3. **Payment Protection**: Holds extended for `AWAITING_PAYMENT` check-ins
4. **Cancellation**: Immediate release on user cancellation

### Waitlist Priority Rules

**Priority Formula**:
```javascript
priority = loyaltyScore + bookingTimeScore + specialNeedsBonus

loyaltyScore:
  - GOLD: 100
  - SILVER: 50
  - BRONZE: 20

bookingTimeScore:
  - Earlier booking = Higher score
  - Max: 50 points
  - Formula: 50 - (daysSinceBooking * 2)

specialNeedsBonus:
  - If hasSpecialNeeds: +50
  - Otherwise: 0
```

### Rate Limiting Rules

1. **API Gateway**: 100 requests per minute per user
2. **Seat Map Access**: 50 requests in 2 seconds → 5 min block
3. **Seat Hold Spam**: 10 holds in 30 seconds → 10 min block

### Authentication Rules

1. **Token Expiry**: 24 hours (configurable via `JWT_EXPIRES_IN`)
2. **Role-Based Access**: passenger, admin, staff
3. **Permission-Based**: Fine-grained action control

---

## Error Handling

### Error Response Format

```javascript
{
  "error": {
    "code": "SEAT_NOT_AVAILABLE",
    "message": "Seat 12A is not available",
    "suggestions": ["11A", "11B", "13A"]  // Alternative seats
  },
  "meta": {
    "timestamp": "2026-02-22T10:15:30Z",
    "requestId": "req_abc123"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `SEAT_NOT_AVAILABLE` | 409 | Seat already taken or held |
| `SEAT_NOT_FOUND` | 404 | Seat doesn't exist |
| `SEAT_HOLD_EXPIRED` | 410 | Hold expired before confirmation |
| `PAYMENT_REQUIRED` | 402 | Baggage fee payment needed |
| `PAYMENT_FAILED` | 402 | Payment processing failed |
| `UNAUTHORIZED` | 401 | Invalid or missing token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `USER_BLOCKED` | 403 | Abuse detected, user blocked |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

---

This workflow design ensures a robust, scalable, and user-friendly check-in experience while maintaining data consistency and system integrity through careful state management, concurrency control, and event-driven architecture.
