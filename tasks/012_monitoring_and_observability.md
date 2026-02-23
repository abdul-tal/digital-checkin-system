# Task 012: Monitoring and Observability Setup

## Objective
Implement comprehensive monitoring with Prometheus metrics, health checks, and structured logging across all microservices.

## Priority
P1 (Should Have) - Critical for production operations

## Description
Set up Prometheus metrics collection, custom metrics for business KPIs, health check endpoints, and structured logging with correlation IDs for distributed tracing.

## Prerequisites
- Task 001-010 completed (All services running)

## Technical Requirements

### 1. Prometheus Metrics Setup

**src/shared/metrics/prometheus.ts:**
```typescript
import promClient from 'prom-client';

// Create registry
export const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics

// HTTP Request Duration
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 2, 3, 5, 7, 10],
  registers: [register],
});

// HTTP Request Total
export const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service'],
  registers: [register],
});

// Seat Hold Attempts
export const seatHoldAttempts = new promClient.Counter({
  name: 'seat_hold_attempts_total',
  help: 'Total number of seat hold attempts',
  labelNames: ['flight_id', 'result'],
  registers: [register],
});

// Seat Hold Expired
export const seatHoldExpired = new promClient.Counter({
  name: 'seat_hold_expired_total',
  help: 'Total number of expired seat holds',
  registers: [register],
});

// Active Seat Holds
export const activeSeatHolds = new promClient.Gauge({
  name: 'active_seat_holds',
  help: 'Current number of active seat holds',
  labelNames: ['flight_id'],
  registers: [register],
});

// Cache Operations
export const cacheOperations = new promClient.Counter({
  name: 'cache_operations_total',
  help: 'Total cache operations',
  labelNames: ['operation', 'result'],
  registers: [register],
});

// Check-In Completions
export const checkinCompletions = new promClient.Counter({
  name: 'checkin_completions_total',
  help: 'Total check-in completions',
  labelNames: ['result'],
  registers: [register],
});

// Payment Transactions
export const paymentTransactions = new promClient.Counter({
  name: 'payment_transactions_total',
  help: 'Total payment transactions',
  labelNames: ['status'],
  registers: [register],
});

// Waitlist Assignments
export const waitlistAssignments = new promClient.Counter({
  name: 'waitlist_assignments_total',
  help: 'Total waitlist assignments',
  registers: [register],
});

// Database Query Duration
export const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['collection', 'operation'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
  registers: [register],
});

// Redis Operation Duration
export const redisOperationDuration = new promClient.Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Duration of Redis operations',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  registers: [register],
});

// Export metrics endpoint handler
export const metricsHandler = async (req: any, res: any) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};
```

### 2. Metrics Middleware

**src/shared/middleware/metrics.middleware.ts:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestTotal } from '../metrics/prometheus';

export const metricsMiddleware = (serviceName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path || req.path;

      const labels = {
        method: req.method,
        route,
        status_code: res.statusCode.toString(),
        service: serviceName,
      };

      httpRequestDuration.observe(labels, duration);
      httpRequestTotal.inc(labels);
    });

    next();
  };
};
```

### 3. Health Check Service

**src/shared/services/health-check.service.ts:**
```typescript
import mongoose from 'mongoose';
import { Redis } from 'ioredis';
import { createLogger } from '../utils/logger';

const logger = createLogger('health-check');

export interface HealthStatus {
  status: 'OK' | 'DEGRADED' | 'DOWN';
  service: string;
  timestamp: Date;
  checks: {
    database: 'UP' | 'DOWN';
    redis: 'UP' | 'DOWN';
    dependencies?: Record<string, 'UP' | 'DOWN'>;
  };
  uptime: number;
}

export class HealthCheckService {
  constructor(
    private serviceName: string,
    private redis?: Redis
  ) {}

  async getHealth(): Promise<HealthStatus> {
    const checks: any = {
      database: await this.checkDatabase(),
      ...(this.redis && { redis: await this.checkRedis() }),
    };

    const allUp = Object.values(checks).every((status) => status === 'UP');
    const status = allUp ? 'OK' : 'DEGRADED';

    return {
      status,
      service: this.serviceName,
      timestamp: new Date(),
      checks,
      uptime: process.uptime(),
    };
  }

  private async checkDatabase(): Promise<'UP' | 'DOWN'> {
    try {
      await mongoose.connection.db?.admin().ping();
      return 'UP';
    } catch (error) {
      logger.error('Database health check failed', { error });
      return 'DOWN';
    }
  }

  private async checkRedis(): Promise<'UP' | 'DOWN'> {
    try {
      await this.redis?.ping();
      return 'UP';
    } catch (error) {
      logger.error('Redis health check failed', { error });
      return 'DOWN';
    }
  }
}
```

### 4. Update Service Entry Points

Add metrics and health checks to each service:

**Example: Update Seat Service (src/seat-service/index.ts):**
```typescript
import { metricsHandler } from '../shared/metrics/prometheus';
import { metricsMiddleware } from '../shared/middleware/metrics.middleware';
import { HealthCheckService } from '../shared/services/health-check.service';

// In bootstrap function:
const healthCheck = new HealthCheckService('seat-service', cacheRedis);

// Add to Express app:
app.use(metricsMiddleware('seat-service'));
app.get('/metrics', metricsHandler);
app.get('/health', async (req, res) => {
  const health = await healthCheck.getHealth();
  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

### 5. Custom Metrics in Services

**Example: Add metrics to Seat Hold Service:**
```typescript
import { seatHoldAttempts, activeSeatHolds } from '../../shared/metrics/prometheus';

// In holdSeat method:
try {
  const seat = await this.seatRepository.findOneAndUpdate(...);
  
  if (!seat) {
    seatHoldAttempts.inc({ flight_id: req.flightId, result: 'conflict' });
    throw new SeatUnavailableError(...);
  }
  
  seatHoldAttempts.inc({ flight_id: req.flightId, result: 'success' });
  activeSeatHolds.inc({ flight_id: req.flightId });
  
  return { ... };
}
```

**Example: Add metrics to Check-In Service:**
```typescript
import { checkinCompletions } from '../../shared/metrics/prometheus';

// In completeCheckIn method:
checkinCompletions.inc({ result: 'success' });
```

**Example: Add metrics to Cache Service:**
```typescript
import { cacheOperations } from '../../shared/metrics/prometheus';

async getSeatMap(flightId: string): Promise<any | null> {
  const cached = await this.redis.get(key);
  
  if (cached) {
    cacheOperations.inc({ operation: 'get', result: 'hit' });
    return JSON.parse(cached);
  }
  
  cacheOperations.inc({ operation: 'get', result: 'miss' });
  return null;
}
```

### 6. Prometheus Configuration

**prometheus.yml:**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'

  - job_name: 'seat-service'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'

  - job_name: 'checkin-service'
    static_configs:
      - targets: ['localhost:3002']
    metrics_path: '/metrics'

  - job_name: 'payment-service'
    static_configs:
      - targets: ['localhost:3003']
    metrics_path: '/metrics'

  - job_name: 'waitlist-service'
    static_configs:
      - targets: ['localhost:3004']
    metrics_path: '/metrics'

  - job_name: 'notification-service'
    static_configs:
      - targets: ['localhost:3005']
    metrics_path: '/metrics'

  - job_name: 'weight-service'
    static_configs:
      - targets: ['localhost:3006']
    metrics_path: '/metrics'

  - job_name: 'abuse-detection-service'
    static_configs:
      - targets: ['localhost:3007']
    metrics_path: '/metrics'
```

### 7. Docker Compose Update

Add Prometheus and Grafana to docker-compose.yml:

```yaml
  prometheus:
    image: prom/prometheus:latest
    container_name: skyhigh-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    container_name: skyhigh-grafana
    ports:
      - "3030:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus

volumes:
  prometheus_data:
  grafana_data:
```

### 8. Structured Logging Enhancement

**src/shared/utils/logger.ts (enhanced):**
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
      version: process.env.APP_VERSION || '1.0.0',
    },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
            return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
          })
        ),
      }),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.json(),
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: winston.format.json(),
      }),
    ],
  });
};
```

## Implementation Steps

1. Create Prometheus metrics definitions
2. Add metrics middleware to all services
3. Implement health check service
4. Add custom metrics to business logic
5. Create Prometheus configuration
6. Update docker-compose with Prometheus and Grafana
7. Configure Grafana dashboards
8. Test metrics collection

## Testing Strategy

### Manual Testing After Completion:

**Test 1: Metrics Endpoint**
```bash
# Check each service
curl http://localhost:3000/metrics
curl http://localhost:3001/metrics
curl http://localhost:3002/metrics
```
Expected: Prometheus-formatted metrics

**Test 2: Health Checks**
```bash
# Check all services
for port in 3000 3001 3002 3003 3004 3005 3006 3007; do
  echo "Port $port:"
  curl http://localhost:$port/health | jq
  echo ""
done
```
Expected: All return status: OK

**Test 3: Prometheus Scraping**
```bash
# Start Prometheus
docker-compose up -d prometheus

# Verify targets
open http://localhost:9090/targets
```
Expected: All 8 services showing as UP

**Test 4: Custom Metrics Verification**
```bash
# Generate some load
for i in {1..50}; do
  curl -s http://localhost:3001/api/v1/flights/SK123/seatmap > /dev/null &
done
wait

# Check metrics
curl -s http://localhost:3001/metrics | grep http_requests_total
curl -s http://localhost:3001/metrics | grep cache_operations_total
```
Expected: Counters incremented

**Test 5: Grafana Dashboard**
```bash
# Start Grafana
docker-compose up -d grafana

# Access Grafana
open http://localhost:3030
# Login: admin / admin
```
Then:
1. Add Prometheus data source (http://prometheus:9090)
2. Import dashboard for SkyHigh metrics
3. Verify panels show data

### Key Metrics to Monitor:

**Performance Metrics:**
- `http_request_duration_seconds` (P50, P95, P99)
- `http_requests_total` (request rate)
- `db_query_duration_seconds`
- `redis_operation_duration_seconds`

**Business Metrics:**
- `seat_hold_attempts_total` (success vs conflict)
- `active_seat_holds` (current holds)
- `seat_hold_expired_total` (expirations)
- `checkin_completions_total`
- `payment_transactions_total`
- `waitlist_assignments_total`

**System Metrics:**
- `process_cpu_usage_percent`
- `process_resident_memory_bytes`
- `cache_operations_total` (hit rate)

### Grafana Dashboard Queries:

**Request Rate:**
```promql
rate(http_requests_total{service="seat-service"}[5m])
```

**P95 Latency:**
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{service="seat-service"}[5m]))
```

**Error Rate:**
```promql
rate(http_requests_total{service="seat-service",status_code=~"5.."}[5m])
```

**Cache Hit Rate:**
```promql
rate(cache_operations_total{result="hit"}[5m]) / rate(cache_operations_total[5m])
```

**Active Seat Holds:**
```promql
sum(active_seat_holds)
```

### Verification Checklist:
- [ ] All services expose /metrics endpoint
- [ ] All services expose /health endpoint
- [ ] Prometheus scrapes all targets successfully
- [ ] Custom business metrics collected
- [ ] HTTP request metrics track duration and count
- [ ] Cache metrics track hit/miss rates
- [ ] Health checks validate database and Redis
- [ ] Grafana displays live metrics
- [ ] Logs include correlation IDs
- [ ] Error logs include stack traces

## Expected Outputs
- Prometheus metrics for all services
- Health check endpoints on all services
- Grafana dashboard with key metrics
- Structured logging with correlation
- Custom business metrics for KPIs
- Production-ready observability stack

## Estimated Complexity
**Medium** - Configuration-heavy but straightforward implementation.

## Dependencies
- Task 001-010 (All services must be running)

## Next Tasks
- Task 013: Testing Suite Implementation
- Task 014: Load Testing Setup
