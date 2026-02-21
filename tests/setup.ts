// Global test setup
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.MONGODB_URI = 'mongodb://localhost:27017/skyhigh_test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Mock console to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Increase timeout for integration tests
jest.setTimeout(10000);
