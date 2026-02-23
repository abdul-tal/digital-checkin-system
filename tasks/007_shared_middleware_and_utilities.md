# Task 007: Shared Middleware and Utilities

## Objective
Implement shared middleware components for error handling, request logging, validation, and common utilities used across all microservices.

## Priority
P0 (Must Have) - Required for consistent behavior across services

## Description
Create reusable middleware for error handling, request/response logging, and common utilities like ID generation, date handling, and HTTP clients.

## Prerequisites
- Task 001 completed (Project setup with logger)

## Technical Requirements

### 1. Error Handler Middleware

**src/shared/middleware/error-handler.ts:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError, SeatUnavailableError } from '../errors/app-error';
import { createLogger } from '../utils/logger';

const logger = createLogger('error-handler');

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
    requestId: req.headers['x-request-id'],
  });

  // Handle known application errors
  if (err instanceof AppError) {
    const response: any = {
      error: {
        code: err.code,
        message: err.message,
      },
    };

    // Add suggestions for seat unavailable errors
    if (err instanceof SeatUnavailableError && err.suggestions.length > 0) {
      response.error.suggestions = err.suggestions;
    }

    return res.status(err.statusCode).json(response);
  }

  // Handle Joi validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
      },
    });
  }

  // Handle Mongoose errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    return res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
      },
    });
  }

  // Handle unknown errors
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    },
  });
};
```

### 2. Request Logger Middleware

**src/shared/middleware/request-logger.ts:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { createLogger } from '../utils/logger';

const logger = createLogger('request-logger');

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Add request ID if not present
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = uuid();
  }

  const requestId = req.headers['x-request-id'] as string;

  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;

    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
};
```

### 3. ID Generation Utility

**src/shared/utils/id-generator.ts:**
```typescript
import { v4 as uuid } from 'uuid';

export const generateId = (prefix?: string): string => {
  const id = uuid();
  return prefix ? `${prefix}_${id}` : id;
};

export const generateCheckInId = (): string => generateId('ci');
export const generateHoldId = (): string => generateId('hold');
export const generatePaymentId = (): string => generateId('pay');
export const generateWaitlistId = (): string => generateId('wl');
```

### 4. Date Utilities

**src/shared/utils/date-utils.ts:**
```typescript
export const addSeconds = (date: Date, seconds: number): Date => {
  return new Date(date.getTime() + seconds * 1000);
};

export const addMinutes = (date: Date, minutes: number): Date => {
  return new Date(date.getTime() + minutes * 60 * 1000);
};

export const addHours = (date: Date, hours: number): Date => {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
};

export const isExpired = (expiryDate: Date): boolean => {
  return new Date() > expiryDate;
};

export const getRemainingSeconds = (expiryDate: Date): number => {
  const remaining = Math.floor((expiryDate.getTime() - Date.now()) / 1000);
  return Math.max(0, remaining);
};

export const formatTimestamp = (date: Date): string => {
  return date.toISOString();
};
```

### 5. Configuration Loader

**src/shared/config/config.ts:**
```typescript
export interface AppConfig {
  nodeEnv: string;
  logLevel: string;
  mongodb: {
    uri: string;
    maxPoolSize: number;
    minPoolSize: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  services: {
    seatService: string;
    checkinService: string;
    paymentService: string;
    waitlistService: string;
    notificationService: string;
    weightService: string;
    abuseDetectionService: string;
  };
  businessRules: {
    seatHoldDuration: number;
    waitlistHoldDuration: number;
    paymentExpiryMinutes: number;
    cancellationWindowHours: number;
    baggageWeightLimit: number;
    baggageMaxWeight: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  cache: {
    seatMapTtl: number;
  };
}

export const loadConfig = (): AppConfig => {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/skyhigh',
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '100'),
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '10'),
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'your-secret-key',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
    services: {
      seatService: process.env.SEAT_SERVICE_URL || 'http://localhost:3001',
      checkinService: process.env.CHECKIN_SERVICE_URL || 'http://localhost:3002',
      paymentService: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003',
      waitlistService: process.env.WAITLIST_SERVICE_URL || 'http://localhost:3004',
      notificationService: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
      weightService: process.env.WEIGHT_SERVICE_URL || 'http://localhost:3006',
      abuseDetectionService: process.env.ABUSE_DETECTION_SERVICE_URL || 'http://localhost:3007',
    },
    businessRules: {
      seatHoldDuration: parseInt(process.env.SEAT_HOLD_DURATION_SECONDS || '120'),
      waitlistHoldDuration: parseInt(process.env.WAITLIST_HOLD_DURATION_SECONDS || '300'),
      paymentExpiryMinutes: parseInt(process.env.PAYMENT_EXPIRY_MINUTES || '30'),
      cancellationWindowHours: parseInt(process.env.CANCELLATION_WINDOW_HOURS || '2'),
      baggageWeightLimit: parseFloat(process.env.BAGGAGE_WEIGHT_LIMIT || '25'),
      baggageMaxWeight: parseFloat(process.env.BAGGAGE_MAX_WEIGHT || '32'),
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    },
    cache: {
      seatMapTtl: parseInt(process.env.CACHE_SEATMAP_TTL_SECONDS || '5'),
    },
  };
};
```

### 6. HTTP Client Base Class

**src/shared/utils/http-client.ts:**
```typescript
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { createLogger } from './logger';

const logger = createLogger('http-client');

export class HttpClient {
  protected client: AxiosInstance;

  constructor(baseURL: string, timeout = 5000) {
    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('HTTP request', {
          method: config.method,
          url: config.url,
          baseURL: config.baseURL,
        });
        return config;
      },
      (error) => {
        logger.error('HTTP request error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('HTTP response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('HTTP response error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}
```

### 7. Async Handler Wrapper

**src/shared/utils/async-handler.ts:**
```typescript
import { Request, Response, NextFunction } from 'express';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

### 8. Response Formatter

**src/shared/utils/response-formatter.ts:**
```typescript
import { Response } from 'express';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, any>
) => {
  res.status(statusCode).json({
    data,
    ...(meta && { meta }),
  });
};

export const sendError = (
  res: Response,
  code: string,
  message: string,
  statusCode = 500,
  details?: any
) => {
  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(details && { details }),
    },
  });
};
```

## Implementation Steps

1. Create shared/middleware directory
2. Implement error handler middleware
3. Implement request logger middleware
4. Create utility functions for IDs, dates, HTTP
5. Implement configuration loader
6. Create response formatters
7. Add async handler wrapper
8. Update existing services to use shared middleware

## Testing Strategy

### Integration with Existing Services:

Update existing services to use the new shared middleware:

**Example: Update Seat Service**
```typescript
// src/seat-service/app.ts
import { errorHandler } from '../shared/middleware/error-handler';
import { requestLogger } from '../shared/middleware/request-logger';

const app = express();
app.use(requestLogger);  // Add request logging
// ... other middleware
app.use(errorHandler);   // Add error handling (must be last)
```

**Test Error Handling:**
```bash
# Test validation error
curl -X POST http://localhost:3001/api/v1/seats/hold \
  -H "Content-Type: application/json" \
  -d '{
    "flightId": "INVALID",
    "seatId": "999Z",
    "passengerId": "P12345"
  }'
```
Expected: 400 error with clear validation message

**Test 404 Error:**
```bash
curl http://localhost:3001/api/v1/invalid-endpoint
```
Expected: 404 error with standard format

**Verify Request Logging:**
Check service logs - should show:
- Incoming request with request ID
- Request duration
- Response status code

### Verification Checklist:
- [ ] Error handler catches all error types
- [ ] Validation errors return 400
- [ ] App errors return correct status codes
- [ ] Request logger adds request ID to all requests
- [ ] Request logger logs duration
- [ ] Configuration loader reads all env variables
- [ ] ID generator creates unique IDs with prefixes
- [ ] Date utilities calculate correctly
- [ ] HTTP client logs requests/responses

## Expected Outputs
- Consistent error handling across all services
- Request/response logging with correlation IDs
- Reusable utilities for common operations
- Configuration management
- Enhanced debugging capabilities

## Estimated Complexity
**Low** - Straightforward middleware and utility implementation.

## Dependencies
- Task 001 (Project setup)

## Next Tasks
- Task 008: Waitlist Service Implementation
- Task 009: Notification Service Implementation
