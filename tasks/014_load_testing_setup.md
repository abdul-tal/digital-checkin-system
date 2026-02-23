# Task 014: Load Testing Setup with k6

## Objective
Set up load testing infrastructure using k6 to verify the system can handle 500+ concurrent users with P95 latency < 1 second.

## Priority
P1 (Should Have) - Validates performance requirements from PRD

## Description
Create k6 load testing scripts to simulate peak check-in scenarios, measure performance under load, and verify conflict-free seat assignment at scale.

## Prerequisites
- Task 001-010 completed (All services running)
- k6 installed (`brew install k6` or download from k6.io)

## Technical Requirements

### 1. k6 Test Scripts Directory

```
k6/
├── scenarios/
│   ├── seat-map-load.js              # Seat map browsing load
│   ├── seat-hold-concurrency.js      # Concurrent seat hold stress test
│   ├── checkin-flow.js               # Complete check-in flow
│   └── peak-hour-simulation.js       # Mixed workload simulation
├── utils/
│   ├── config.js                     # Test configuration
│   └── helpers.js                    # Helper functions
└── results/                          # Test results output
```

### 2. Test Configuration

**k6/utils/config.js:**
```javascript
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
export const TEST_FLIGHT_ID = __ENV.FLIGHT_ID || 'SK123';

// Mock authentication token (in production, implement proper login flow)
export const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'mock-jwt-token';

// Test stages
export const STAGES = {
  warmup: { duration: '1m', target: 50 },
  rampUp: { duration: '2m', target: 200 },
  peak: { duration: '5m', target: 500 },
  rampDown: { duration: '2m', target: 0 },
};

// Performance thresholds from PRD
export const THRESHOLDS = {
  http_req_duration: ['p(95)<1000', 'p(99)<2000'], // 95% < 1s, 99% < 2s
  http_req_failed: ['rate<0.01'],                   // Error rate < 1%
  http_reqs: ['rate>100'],                          // Min 100 req/s
};
```

**k6/utils/helpers.js:**
```javascript
import { check } from 'k6';
import { AUTH_TOKEN } from './config.js';

export const getAuthHeaders = () => ({
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json',
});

export const randomSeat = () => {
  const row = Math.floor(Math.random() * 30) + 1;
  const col = String.fromCharCode(65 + Math.floor(Math.random() * 6)); // A-F
  return `${row}${col}`;
};

export const randomPassengerId = (vuId) => `P${vuId}_${Date.now()}`;

export const logResult = (name, response) => {
  console.log(`[${name}] Status: ${response.status}, Duration: ${response.timings.duration}ms`);
};
```

### 3. Seat Map Load Test

**k6/scenarios/seat-map-load.js:**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { BASE_URL, TEST_FLIGHT_ID, STAGES, THRESHOLDS } from '../utils/config.js';
import { getAuthHeaders } from '../utils/helpers.js';

export const errorRate = new Rate('errors');

export const options = {
  stages: [
    STAGES.warmup,
    STAGES.rampUp,
    STAGES.peak,
    STAGES.rampDown,
  ],
  thresholds: THRESHOLDS,
};

export default function () {
  // Test seat map browsing (80% of traffic per PRD)
  const response = http.get(
    `${BASE_URL}/flights/${TEST_FLIGHT_ID}/seatmap`,
    { headers: getAuthHeaders() }
  );

  const result = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 1s': (r) => r.timings.duration < 1000,
    'has seat data': (r) => JSON.parse(r.body).seats !== undefined,
    'available seats count present': (r) => JSON.parse(r.body).availableSeats >= 0,
  });

  if (!result) {
    errorRate.add(1);
  }

  sleep(Math.random() * 3 + 1); // 1-4 seconds between requests
}
```

### 4. Concurrent Seat Hold Test

**k6/scenarios/seat-hold-concurrency.js:**
```javascript
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE_URL, TEST_FLIGHT_ID } from '../utils/config.js';
import { getAuthHeaders, randomPassengerId } from '../utils/helpers.js';

// Custom metrics
const holdSuccesses = new Counter('seat_hold_successes');
const holdConflicts = new Counter('seat_hold_conflicts');

export const options = {
  scenarios: {
    // 100 users try to book the SAME seat simultaneously
    sameSeatConflict: {
      executor: 'shared-iterations',
      vus: 100,
      iterations: 100,
      maxDuration: '30s',
    },
  },
  thresholds: {
    seat_hold_successes: ['count==1'],  // Exactly 1 success
    seat_hold_conflicts: ['count==99'],  // Exactly 99 conflicts
  },
};

export default function () {
  const targetSeat = '20C'; // All VUs target the same seat

  const response = http.post(
    `${BASE_URL}/seats/hold`,
    JSON.stringify({
      flightId: TEST_FLIGHT_ID,
      seatId: targetSeat,
      passengerId: randomPassengerId(__VU),
    }),
    { headers: getAuthHeaders() }
  );

  if (response.status === 200) {
    holdSuccesses.add(1);
    console.log(`✅ VU ${__VU} successfully held seat ${targetSeat}`);
  } else if (response.status === 409) {
    holdConflicts.add(1);
    const body = JSON.parse(response.body);
    check(body, {
      'has suggestions': (b) => b.error.suggestions && b.error.suggestions.length > 0,
    });
  } else {
    console.error(`❌ VU ${__VU} unexpected status: ${response.status}`);
  }
}
```

### 5. Complete Check-In Flow Test

**k6/scenarios/checkin-flow.js:**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, TEST_FLIGHT_ID } from '../utils/config.js';
import { getAuthHeaders, randomSeat, randomPassengerId } from '../utils/helpers.js';

const checkinDuration = new Trend('checkin_flow_duration');
const checkinSuccesses = new Counter('checkin_successes');
const checkinFailures = new Counter('checkin_failures');

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    checkin_flow_duration: ['p(95)<180000'], // 95% complete in < 3 minutes
    checkin_successes: ['count>80'],         // At least 80% success rate
  },
};

export default function () {
  const startTime = Date.now();
  const passengerId = randomPassengerId(__VU);
  const userId = `U${__VU}`;

  try {
    // Step 1: Start check-in
    const startRes = http.post(
      `${BASE_URL}/checkin/start`,
      JSON.stringify({
        passengerId,
        userId,
        bookingId: `BK${__VU}`,
      }),
      { headers: getAuthHeaders() }
    );

    check(startRes, {
      'start check-in success': (r) => r.status === 200,
    });

    if (startRes.status !== 200) {
      checkinFailures.add(1);
      return;
    }

    const checkInId = JSON.parse(startRes.body).checkInId;

    sleep(2); // User browses seat map

    // Step 2: Complete check-in (no baggage)
    const completeRes = http.post(
      `${BASE_URL}/checkin/complete`,
      JSON.stringify({
        checkInId,
        passengerId,
        userId,
        seatId: randomSeat(),
        baggage: { count: 0 },
      }),
      { headers: getAuthHeaders() }
    );

    const success = check(completeRes, {
      'complete check-in success': (r) => r.status === 200 || r.status === 409,
      'has boarding pass or payment': (r) => {
        const body = JSON.parse(r.body);
        return body.boardingPass !== undefined || body.paymentUrl !== undefined;
      },
    });

    if (success) {
      checkinSuccesses.add(1);
      const duration = Date.now() - startTime;
      checkinDuration.add(duration);
    } else {
      checkinFailures.add(1);
    }

  } catch (error) {
    checkinFailures.add(1);
    console.error(`VU ${__VU} error:`, error);
  }

  sleep(1);
}
```

### 6. Peak Hour Simulation

**k6/scenarios/peak-hour-simulation.js:**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, TEST_FLIGHT_ID, STAGES, THRESHOLDS } from '../utils/config.js';
import { getAuthHeaders, randomSeat, randomPassengerId } from '../utils/helpers.js';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 500 },   // Peak load
    { duration: '10m', target: 500 },  // Sustained peak
    { duration: '2m', target: 0 },
  ],
  thresholds: THRESHOLDS,
};

export default function () {
  const scenario = Math.random();

  if (scenario < 0.6) {
    // 60% - Browse seat map only
    browseSeatMap();
  } else if (scenario < 0.85) {
    // 25% - Hold seat
    holdSeat();
  } else {
    // 15% - Complete check-in
    completeCheckIn();
  }

  sleep(Math.random() * 5 + 2); // 2-7 seconds think time
}

function browseSeatMap() {
  const response = http.get(
    `${BASE_URL}/flights/${TEST_FLIGHT_ID}/seatmap`,
    { headers: getAuthHeaders() }
  );

  check(response, {
    'seat map loaded': (r) => r.status === 200,
    'seat map fast': (r) => r.timings.duration < 1000,
  });
}

function holdSeat() {
  const response = http.post(
    `${BASE_URL}/seats/hold`,
    JSON.stringify({
      flightId: TEST_FLIGHT_ID,
      seatId: randomSeat(),
      passengerId: randomPassengerId(__VU),
    }),
    { headers: getAuthHeaders() }
  );

  check(response, {
    'hold success or conflict': (r) => r.status === 200 || r.status === 409,
  });
}

function completeCheckIn() {
  // Simplified - start and complete in one scenario
  const passengerId = randomPassengerId(__VU);

  const startRes = http.post(
    `${BASE_URL}/checkin/start`,
    JSON.stringify({
      passengerId,
      userId: `U${__VU}`,
      bookingId: `BK${__VU}`,
    }),
    { headers: getAuthHeaders() }
  );

  if (startRes.status === 200) {
    const checkInId = JSON.parse(startRes.body).checkInId;

    sleep(1);

    http.post(
      `${BASE_URL}/checkin/complete`,
      JSON.stringify({
        checkInId,
        passengerId,
        userId: `U${__VU}`,
        seatId: randomSeat(),
        baggage: { count: 0 },
      }),
      { headers: getAuthHeaders() }
    );
  }
}
```

### 7. Run Scripts

**k6/run-all-tests.sh:**
```bash
#!/bin/bash

echo "🚀 Starting SkyHigh Load Tests"
echo "=============================="

# Ensure services are running
echo "Checking services..."
curl -s http://localhost:3000/health > /dev/null || { echo "❌ API Gateway not running"; exit 1; }
curl -s http://localhost:3001/health > /dev/null || { echo "❌ Seat Service not running"; exit 1; }

# Run tests
echo ""
echo "Test 1: Seat Map Load Test"
echo "---------------------------"
k6 run --out json=k6/results/seat-map-load.json k6/scenarios/seat-map-load.js

echo ""
echo "Test 2: Concurrent Seat Hold (Conflict Test)"
echo "---------------------------------------------"
k6 run --out json=k6/results/seat-hold-concurrency.json k6/scenarios/seat-hold-concurrency.js

echo ""
echo "Test 3: Complete Check-In Flow"
echo "-------------------------------"
k6 run --out json=k6/results/checkin-flow.json k6/scenarios/checkin-flow.js

echo ""
echo "Test 4: Peak Hour Simulation (500 concurrent users)"
echo "----------------------------------------------------"
k6 run --out json=k6/results/peak-hour.json k6/scenarios/peak-hour-simulation.js

echo ""
echo "✅ All load tests completed"
echo "Results saved in k6/results/"
```

### 8. Results Analysis Script

**k6/analyze-results.js:**
```javascript
const fs = require('fs');
const path = require('path');

function analyzeResults(filename) {
  const data = fs.readFileSync(path.join(__dirname, 'results', filename), 'utf-8');
  const lines = data.trim().split('\n');
  
  let metrics = {
    http_req_duration: [],
    http_req_failed: 0,
    http_reqs: 0,
  };

  lines.forEach(line => {
    try {
      const record = JSON.parse(line);
      if (record.type === 'Point' && record.metric === 'http_req_duration') {
        metrics.http_req_duration.push(record.data.value);
      }
      if (record.type === 'Point' && record.metric === 'http_req_failed') {
        metrics.http_req_failed += record.data.value;
      }
      if (record.type === 'Point' && record.metric === 'http_reqs') {
        metrics.http_reqs += record.data.value;
      }
    } catch (e) {
      // Skip invalid lines
    }
  });

  // Calculate percentiles
  metrics.http_req_duration.sort((a, b) => a - b);
  const p50 = metrics.http_req_duration[Math.floor(metrics.http_req_duration.length * 0.5)];
  const p95 = metrics.http_req_duration[Math.floor(metrics.http_req_duration.length * 0.95)];
  const p99 = metrics.http_req_duration[Math.floor(metrics.http_req_duration.length * 0.99)];

  console.log(`\n📊 Results for ${filename}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total Requests: ${metrics.http_reqs}`);
  console.log(`Failed Requests: ${metrics.http_req_failed}`);
  console.log(`Error Rate: ${(metrics.http_req_failed / metrics.http_reqs * 100).toFixed(2)}%`);
  console.log(`P50 Duration: ${p50.toFixed(2)}ms`);
  console.log(`P95 Duration: ${p95.toFixed(2)}ms`);
  console.log(`P99 Duration: ${p99.toFixed(2)}ms`);
  console.log(`\n✅ P95 < 1s: ${p95 < 1000 ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Error Rate < 1%: ${(metrics.http_req_failed / metrics.http_reqs) < 0.01 ? 'PASS' : 'FAIL'}`);
}

// Run analysis on all result files
const resultsDir = path.join(__dirname, 'results');
const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'));

files.forEach(file => analyzeResults(file));
```

### 9. Hold Expiration Load Test

**k6/scenarios/hold-expiration-load.js:**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, TEST_FLIGHT_ID } from '../utils/config.js';
import { getAuthHeaders, randomSeat, randomPassengerId } from '../utils/helpers.js';

export const options = {
  scenarios: {
    createHolds: {
      executor: 'constant-vus',
      vus: 100,
      duration: '30s',
    },
  },
};

export default function () {
  // Hold a random seat
  const response = http.post(
    `${BASE_URL}/seats/hold`,
    JSON.stringify({
      flightId: TEST_FLIGHT_ID,
      seatId: randomSeat(),
      passengerId: randomPassengerId(__VU),
    }),
    { headers: getAuthHeaders() }
  );

  if (response.status === 200) {
    const body = JSON.parse(response.body);
    console.log(`VU ${__VU} held seat ${body.seatId}, expires at ${body.expiresAt}`);
  }
}

// After test completes, wait 120 seconds and verify all seats released
export function teardown(data) {
  console.log('Waiting 130 seconds for all holds to expire...');
  sleep(130);

  // Check seat map - all seats should be available
  const response = http.get(
    `${BASE_URL}/flights/${TEST_FLIGHT_ID}/seatmap`,
    { headers: getAuthHeaders() }
  );

  const body = JSON.parse(response.body);
  const availableCount = body.seats.filter(s => s.state === 'AVAILABLE').length;

  console.log(`Available seats after expiration: ${availableCount} / ${body.totalSeats}`);
  console.log(`✅ Hold expiration test: ${availableCount === body.totalSeats ? 'PASS' : 'FAIL'}`);
}
```

## Implementation Steps

1. Install k6 load testing tool
2. Create k6 test scripts directory
3. Implement seat map load test
4. Implement concurrent seat hold test
5. Implement complete check-in flow test
6. Implement peak hour simulation
7. Create hold expiration verification test
8. Add results analysis scripts
9. Create run-all script
10. Document expected results and thresholds

## Testing Strategy

### Run Load Tests:

**Prerequisites:**
```bash
# 1. Ensure all services are running
npm run dev:gateway &
npm run dev:seat &
npm run dev:checkin &
npm run dev:payment &
npm run dev:weight &

# 2. Seed test data (ensure 180 seats available)
npm run seed

# 3. Get auth token (or use mock token)
export AUTH_TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass"}' | jq -r '.token')
```

**Run Individual Tests:**
```bash
# Seat map load test
k6 run k6/scenarios/seat-map-load.js

# Concurrent seat hold test
k6 run k6/scenarios/seat-hold-concurrency.js

# Check-in flow test
k6 run k6/scenarios/checkin-flow.js

# Peak hour simulation (500 concurrent users)
k6 run k6/scenarios/peak-hour-simulation.js
```

**Run All Tests:**
```bash
chmod +x k6/run-all-tests.sh
./k6/run-all-tests.sh
```

**Analyze Results:**
```bash
node k6/analyze-results.js
```

### Performance Targets from PRD:

| Metric | Target | Test Scenario |
|--------|--------|---------------|
| P95 Response Time | < 1s | seat-map-load.js |
| P99 Response Time | < 2s | seat-map-load.js |
| Concurrent Users | 500+ | peak-hour-simulation.js |
| Error Rate | < 1% | All tests |
| Seat Conflicts | Exactly 1 success | seat-hold-concurrency.js |
| Check-In Time | < 3 min | checkin-flow.js |

### Verification Checklist:
- [ ] k6 installed and configured
- [ ] Seat map load test passes with 500 VUs
- [ ] P95 latency < 1 second
- [ ] Concurrent seat hold produces exactly 1 success
- [ ] Check-in flow completes in < 3 minutes
- [ ] Hold expiration test verifies all seats released
- [ ] Peak hour simulation succeeds
- [ ] Error rate < 1% across all tests
- [ ] Results saved for analysis
- [ ] Performance dashboard shows metrics

## Expected Outputs
- k6 load testing scripts for all scenarios
- Performance validation for 500+ concurrent users
- Conflict-free seat assignment proof (1 success from 100 requests)
- Hold expiration verification
- Results analysis tooling
- Performance baseline data

## Estimated Complexity
**Medium** - Requires understanding of load testing patterns and k6 scripting.

## Dependencies
- Task 001-010 (All services running)
- k6 tool installed

## Next Tasks
- Task 015: API Documentation with Swagger
