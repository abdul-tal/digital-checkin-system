import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { createAuthMiddleware } from '../middleware/authentication.middleware';
import { requirePermission } from '../middleware/authorization.middleware';
import { proxyRequest } from '../middleware/proxy.middleware';
import { createRateLimiter } from '../middleware/rate-limiter.middleware';

export const createGatewayRoutes = (authService: AuthService): Router => {
  const router = Router();
  const authenticate = createAuthMiddleware(authService);

  const publicRateLimit = createRateLimiter(60000, 20, 'public');
  const userRateLimit = createRateLimiter(60000, 100, 'user');

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

  router.get(
    '/checkin/:checkInId',
    authenticate,
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

  router.post(
    '/payments/:paymentId/confirm',
    publicRateLimit,
    proxyRequest(process.env.PAYMENT_SERVICE_URL!)
  );

  return router;
};
