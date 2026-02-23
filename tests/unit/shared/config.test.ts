import { loadConfig } from '../../../src/shared/config/config';

describe('Config Loader', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load default configuration', () => {
    const config = loadConfig();

    expect(config).toBeDefined();
    expect(config.nodeEnv).toBe('test');
    expect(config.mongodb.uri).toBeDefined();
    expect(config.redis.host).toBeDefined();
    expect(config.services).toBeDefined();
    expect(config.businessRules).toBeDefined();
  });

  it('should use environment variables when provided', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_LEVEL = 'warn';
    process.env.MONGODB_URI = 'mongodb://prod:27017/db';

    const config = loadConfig();

    expect(config.nodeEnv).toBe('production');
    expect(config.logLevel).toBe('warn');
    expect(config.mongodb.uri).toBe('mongodb://prod:27017/db');
  });

  it('should parse integer values from environment', () => {
    process.env.MONGODB_MAX_POOL_SIZE = '50';
    process.env.REDIS_PORT = '6380';
    process.env.SEAT_HOLD_DURATION_SECONDS = '180';

    const config = loadConfig();

    expect(config.mongodb.maxPoolSize).toBe(50);
    expect(config.redis.port).toBe(6380);
    expect(config.businessRules.seatHoldDuration).toBe(180);
  });

  it('should parse float values from environment', () => {
    process.env.BAGGAGE_WEIGHT_LIMIT = '30.5';
    process.env.BAGGAGE_MAX_WEIGHT = '35.5';

    const config = loadConfig();

    expect(config.businessRules.baggageWeightLimit).toBe(30.5);
    expect(config.businessRules.baggageMaxWeight).toBe(35.5);
  });

  it('should load all service URLs', () => {
    const config = loadConfig();

    expect(config.services.seatService).toBeDefined();
    expect(config.services.checkinService).toBeDefined();
    expect(config.services.paymentService).toBeDefined();
    expect(config.services.waitlistService).toBeDefined();
    expect(config.services.notificationService).toBeDefined();
    expect(config.services.weightService).toBeDefined();
    expect(config.services.abuseDetectionService).toBeDefined();
  });

  it('should load business rules', () => {
    const config = loadConfig();

    expect(config.businessRules.seatHoldDuration).toBeGreaterThan(0);
    expect(config.businessRules.waitlistHoldDuration).toBeGreaterThan(0);
    expect(config.businessRules.paymentExpiryMinutes).toBeGreaterThan(0);
    expect(config.businessRules.cancellationWindowHours).toBeGreaterThan(0);
    expect(config.businessRules.baggageWeightLimit).toBeGreaterThan(0);
    expect(config.businessRules.baggageMaxWeight).toBeGreaterThan(0);
  });

  it('should load rate limit configuration', () => {
    const config = loadConfig();

    expect(config.rateLimit.windowMs).toBeGreaterThan(0);
    expect(config.rateLimit.maxRequests).toBeGreaterThan(0);
  });

  it('should handle missing optional redis password', () => {
    delete process.env.REDIS_PASSWORD;

    const config = loadConfig();

    expect(config.redis.password).toBeUndefined();
  });

  it('should use defaults when environment variables are missing', () => {
    delete process.env.MONGODB_URI;
    delete process.env.REDIS_HOST;

    const config = loadConfig();

    expect(config.mongodb.uri).toBe('mongodb://localhost:27017/skyhigh');
    expect(config.redis.host).toBe('localhost');
  });
});
