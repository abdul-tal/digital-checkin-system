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
