# Task 010: API Gateway Implementation

## Objective
Implement the API Gateway Service as a unified entry point with JWT authentication, request routing, rate limiting, and CORS configuration.

## Priority
P0 (Must Have) - Single entry point for all client requests

## Description
Build the API Gateway that handles authentication, routes requests to appropriate microservices, enforces rate limits, and provides a consistent API interface for clients.

## Prerequisites
- Task 001-006 completed (All core services running)
- Task 007 completed (Shared middleware)

## Technical Requirements

### 1. Directory Structure

```
src/api-gateway/
├── middleware/
│   ├── authentication.middleware.ts     # JWT validation
│   ├── authorization.middleware.ts      # Role-based access
│   ├── rate-limiter.middleware.ts       # Rate limiting
│   └── proxy.middleware.ts              # Request proxying
├── services/
│   ├── auth.service.ts                  # JWT generation/validation
│   └── service-registry.service.ts      # Service discovery
├── routes/
│   ├── gateway.routes.ts                # Main routing config
│   └── auth.routes.ts                   # Auth endpoints
├── controllers/
│   └── auth.controller.ts               # Login/logout handlers
├── app.ts
└── index.ts
```

### 2. JWT Authentication Service

**src/api-gateway/services/auth.service.ts:**
```typescript
import jwt from 'jsonwebtoken';
import { createLogger } from '../../shared/utils/logger';
import { UnauthorizedError } from '../../shared/errors/app-error';

const logger = createLogger('auth-service');

export interface JWTPayload {
  userId: string;
  role: 'passenger' | 'staff' | 'admin';
  loyaltyTier?: 'PLATINUM' | 'GOLD' | 'SILVER' | 'REGULAR';
  permissions: string[];
  iat?: number;
  exp?: number;
}

export class AuthService {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor() {
    this.secret = process.env.JWT_SECRET || 'your-secret-key';
    this.expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  }

  generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    const token = jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: 'skyhigh-core',
      audience: 'skyhigh-api',
    });

    logger.info('Token generated', { userId: payload.userId, role: payload.role });

    return token;
  }

  verifyToken(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, this.secret, {
        issuer: 'skyhigh-core',
        audience: 'skyhigh-api',
      }) as JWTPayload;

      return payload;
    } catch (error: any) {
      logger.warn('Token verification failed', { error: error.message });
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  // Mock login (for testing)
  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    // In production, validate credentials against user database
    // For now, mock successful login

    const user = {
      userId: `U_${email.split('@')[0]}`,
      email,
      role: 'passenger' as const,
      loyaltyTier: 'GOLD' as const,
    };

    const token = this.generateToken({
      userId: user.userId,
      role: user.role,
      loyaltyTier: user.loyaltyTier,
      permissions: ['book:seat', 'cancel:checkin', 'join:waitlist'],
    });

    logger.info('User logged in', { userId: user.userId, email });

    return { token, user };
  }
}
```

### 3. Authentication Middleware

**src/api-gateway/middleware/authentication.middleware.ts:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { UnauthorizedError } from '../../shared/errors/app-error';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    loyaltyTier?: string;
    permissions: string[];
  };
}

export const createAuthMiddleware = (authService: AuthService) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const payload = authService.verifyToken(token);

      // Attach user info to request
      req.user = {
        userId: payload.userId,
        role: payload.role,
        loyaltyTier: payload.loyaltyTier,
        permissions: payload.permissions,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};
```

### 4. Authorization Middleware

**src/api-gateway/middleware/authorization.middleware.ts:**
```typescript
import { Response, NextFunction } from 'express';
import { AuthRequest } from './authentication.middleware';
import { ForbiddenError } from '../../shared/errors/app-error';

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ForbiddenError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};

export const requirePermission = (...requiredPermissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ForbiddenError('Authentication required'));
    }

    const hasPermission = requiredPermissions.some((perm) =>
      req.user!.permissions.includes(perm)
    );

    if (!hasPermission) {
      return next(
        new ForbiddenError(`Requires one of: ${requiredPermissions.join(', ')}`)
      );
    }

    next();
  };
};
```

### 5. Rate Limiter Middleware

**src/api-gateway/middleware/rate-limiter.middleware.ts:**
```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createRedisClient } from '../../shared/config/redis';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('rate-limiter');

export const createRateLimiter = (
  windowMs: number,
  max: number,
  keyPrefix = 'global'
) => {
  return rateLimit({
    store: new RedisStore({
      client: createRedisClient(),
      prefix: `rate_limit:${keyPrefix}:`,
    }),
    windowMs,
    max,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Please try again in ${Math.ceil(windowMs / 1000)} seconds.`,
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      const user = (req as any).user;
      return user?.userId || req.ip;
    },
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        userId: (req as any).user?.userId,
        ip: req.ip,
        path: req.path,
      });

      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(windowMs / 1000),
        },
      });
    },
  });
};
```

### 6. Request Proxy Middleware

**src/api-gateway/middleware/proxy.middleware.ts:**
```typescript
import axios from 'axios';
import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('proxy-middleware');

export const proxyRequest = (targetServiceUrl: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const url = `${targetServiceUrl}${req.path}`;

      logger.debug('Proxying request', {
        method: req.method,
        targetUrl: url,
        requestId: req.headers['x-request-id'],
      });

      const response = await axios({
        method: req.method,
        url,
        data: req.body,
        params: req.query,
        headers: {
          ...req.headers,
          host: undefined, // Remove original host header
        },
        timeout: 30000,
      });

      res.status(response.status).json(response.data);
    } catch (error: any) {
      if (error.response) {
        // Forward error response from service
        res.status(error.response.status).json(error.response.data);
      } else {
        logger.error('Proxy error', { error: error.message });
        next(error);
      }
    }
  };
};
```

### 7. Gateway Routes

**src/api-gateway/routes/gateway.routes.ts:**
```typescript
import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { createAuthMiddleware } from '../middleware/authentication.middleware';
import { requirePermission } from '../middleware/authorization.middleware';
import { proxyRequest } from '../middleware/proxy.middleware';
import { createRateLimiter } from '../middleware/rate-limiter.middleware';

export const createGatewayRoutes = (authService: AuthService): Router => {
  const router = Router();
  const authenticate = createAuthMiddleware(authService);

  // Rate limiters
  const publicRateLimit = createRateLimiter(60000, 20, 'public');
  const userRateLimit = createRateLimiter(60000, 100, 'user');

  // Seat Service routes
  router.get(
    '/flights/:flightId/seatmap',
    authenticate,
    userRateLimit,
    proxyRequest(process.env.SEAT_SERVICE_URL!)
  );

  router.post(
    '/seats/hold',
    authenticate,
    requirePermission('book:seat'),
    userRateLimit,
    proxyRequest(process.env.SEAT_SERVICE_URL!)
  );

  router.post(
    '/seats/release',
    authenticate,
    userRateLimit,
    proxyRequest(process.env.SEAT_SERVICE_URL!)
  );

  // Check-In Service routes
  router.post(
    '/checkin/start',
    authenticate,
    userRateLimit,
    proxyRequest(process.env.CHECKIN_SERVICE_URL!)
  );

  router.post(
    '/checkin/complete',
    authenticate,
    requirePermission('book:seat'),
    userRateLimit,
    proxyRequest(process.env.CHECKIN_SERVICE_URL!)
  );

  router.post(
    '/checkin/:checkInId/cancel',
    authenticate,
    requirePermission('cancel:checkin'),
    userRateLimit,
    proxyRequest(process.env.CHECKIN_SERVICE_URL!)
  );

  // Waitlist Service routes
  router.post(
    '/waitlist/join',
    authenticate,
    requirePermission('join:waitlist'),
    userRateLimit,
    proxyRequest(process.env.WAITLIST_SERVICE_URL!)
  );

  router.delete(
    '/waitlist/:waitlistId',
    authenticate,
    userRateLimit,
    proxyRequest(process.env.WAITLIST_SERVICE_URL!)
  );

  // Payment Service routes (public for mock payment page)
  router.post(
    '/payments/:paymentId/confirm',
    publicRateLimit,
    proxyRequest(process.env.PAYMENT_SERVICE_URL!)
  );

  return router;
};
```

### 8. Auth Routes

**src/api-gateway/routes/auth.routes.ts:**
```typescript
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

export const createAuthRoutes = (controller: AuthController): Router => {
  const router = Router();

  router.post('/auth/login', controller.login);
  router.post('/auth/logout', controller.logout);

  return router;
};
```

**src/api-gateway/controllers/auth.controller.ts:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { ValidationError } from '../../shared/errors/app-error';

export class AuthController {
  constructor(private authService: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new ValidationError('Email and password are required');
      }

      const result = await this.authService.login(email, password);

      res.json({
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    // For JWT, logout is client-side (delete token)
    // Could implement token blacklist here if needed
    res.json({ message: 'Logged out successfully' });
  };
}
```

### 9. Express App

**src/api-gateway/app.ts:**
```typescript
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { createGatewayRoutes } from './routes/gateway.routes';
import { createAuthRoutes } from './routes/auth.routes';
import { errorHandler } from '../shared/middleware/error-handler';
import { requestLogger } from '../shared/middleware/request-logger';

export const createApp = (authService: AuthService): Express => {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ],
    credentials: true,
  }));
  app.use(compression());

  // Parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Logging
  app.use(requestLogger);

  // Auth routes (no authentication required)
  const authController = new AuthController(authService);
  app.use('/api/v1', createAuthRoutes(authController));

  // Gateway routes (authentication required)
  app.use('/api/v1', createGatewayRoutes(authService));

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'OK',
      service: 'api-gateway',
      timestamp: new Date(),
    });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
};
```

### 10. Service Entry Point

**src/api-gateway/index.ts:**
```typescript
import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { AuthService } from './services/auth.service';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('api-gateway');
const PORT = process.env.API_GATEWAY_PORT || 3000;

async function bootstrap() {
  try {
    // Initialize services
    const authService = new AuthService();

    // Create Express app
    const app = createApp(authService);

    // Start server
    app.listen(PORT, () => {
      logger.info(`API Gateway listening on port ${PORT}`);
      logger.info('Service endpoints:');
      logger.info(`  - Seat Service: ${process.env.SEAT_SERVICE_URL}`);
      logger.info(`  - Check-In Service: ${process.env.CHECKIN_SERVICE_URL}`);
      logger.info(`  - Payment Service: ${process.env.PAYMENT_SERVICE_URL}`);
      logger.info(`  - Waitlist Service: ${process.env.WAITLIST_SERVICE_URL}`);
    });
  } catch (error) {
    logger.error('Failed to start API Gateway', { error });
    process.exit(1);
  }
}

bootstrap();
```

## Implementation Steps

1. Create api-gateway directory structure
2. Implement JWT authentication service
3. Create authentication middleware
4. Create authorization middleware (role/permission checks)
5. Implement rate limiter with Redis
6. Create proxy middleware for request forwarding
7. Set up routes for all services
8. Create auth endpoints (login/logout)
9. Configure CORS and security headers
10. Test all routes through gateway

## Testing Strategy

### Complete System Test Through API Gateway:

**Test 1: Login**
```bash
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' | jq -r '.token')

echo "Token: $TOKEN"
```

**Test 2: Get Seat Map (Authenticated)**
```bash
curl http://localhost:3000/api/v1/flights/SK123/seatmap \
  -H "Authorization: Bearer $TOKEN"
```
Expected: 200 OK with seat map

**Test 3: Hold Seat Through Gateway**
```bash
curl -X POST http://localhost:3000/api/v1/seats/hold \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "flightId": "SK123",
    "seatId": "10A",
    "passengerId": "P12345"
  }'
```
Expected: 200 OK with holdId

**Test 4: Complete Check-In Through Gateway**
```bash
# Start check-in
CHECKIN=$(curl -X POST http://localhost:3000/api/v1/checkin/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "passengerId": "P12345",
    "userId": "U_test",
    "bookingId": "BK789"
  }' | jq -r '.checkInId')

# Complete check-in
curl -X POST http://localhost:3000/api/v1/checkin/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"checkInId\": \"$CHECKIN\",
    \"passengerId\": \"P12345\",
    \"userId\": \"U_test\",
    \"seatId\": \"11B\",
    \"baggage\": { \"count\": 0 }
  }" | jq
```

**Test 5: Unauthorized Request**
```bash
curl http://localhost:3000/api/v1/flights/SK123/seatmap
```
Expected: 401 Unauthorized

**Test 6: Rate Limiting**
```bash
# Send 25 requests rapidly (exceeds 20 req/min for public)
for i in {1..25}; do
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"pass"}' &
done
wait
```
Expected: First 20 succeed, remaining 5 return 429

### Verification Checklist:
- [ ] API Gateway starts on port 3000
- [ ] Login endpoint generates valid JWT
- [ ] JWT authentication middleware validates tokens
- [ ] Authenticated requests proxied to correct services
- [ ] Unauthenticated requests return 401
- [ ] Rate limiting enforces limits per user/IP
- [ ] CORS headers set correctly
- [ ] Security headers applied (helmet)
- [ ] Request logging includes request ID
- [ ] Error responses have consistent format
- [ ] All service routes accessible through gateway

## Expected Outputs
- Working API Gateway on port 3000
- JWT-based authentication
- Request routing to all microservices
- Rate limiting with Redis
- Role-based authorization
- Unified API interface for clients
- Production-ready security headers

## Estimated Complexity
**High** - Central service with authentication, routing, and multiple middleware layers.

## Dependencies
- Task 001-006 (All core services)
- Task 007 (Shared middleware)

## Next Tasks
- Task 011: Abuse Detection Service
- After this task, all requests should go through the gateway!
