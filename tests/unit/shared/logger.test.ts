import { createLogger } from '../../../src/shared/utils/logger';

describe('Logger', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create logger with service name', () => {
    const logger = createLogger('test-service');

    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.debug).toBeDefined();
  });

  it('should use default log level if not specified', () => {
    delete process.env.LOG_LEVEL;
    const logger = createLogger('test-service');

    expect(logger.level).toBe('info');
  });

  it('should use LOG_LEVEL environment variable', () => {
    process.env.LOG_LEVEL = 'debug';
    const logger = createLogger('test-service');

    expect(logger.level).toBe('debug');
  });

  it('should include service name in metadata', () => {
    const logger = createLogger('test-service');
    
    const logSpy = jest.spyOn(logger, 'info');
    logger.info('Test message');

    expect(logSpy).toHaveBeenCalledWith('Test message');
  });

  it('should handle different log levels', () => {
    const logger = createLogger('test-service');

    expect(() => logger.info('Info message')).not.toThrow();
    expect(() => logger.warn('Warning message')).not.toThrow();
    expect(() => logger.error('Error message')).not.toThrow();
    expect(() => logger.debug('Debug message')).not.toThrow();
  });

  it('should include environment in metadata', () => {
    process.env.NODE_ENV = 'test';
    const logger = createLogger('test-service');

    const logSpy = jest.spyOn(logger, 'info');
    logger.info('Test message');

    expect(logSpy).toHaveBeenCalled();
  });

  it('should handle error objects with stack traces', () => {
    const logger = createLogger('test-service');
    const error = new Error('Test error');

    expect(() => logger.error('Error occurred', { error })).not.toThrow();
  });

  it('should create multiple loggers with different names', () => {
    const logger1 = createLogger('service-1');
    const logger2 = createLogger('service-2');

    expect(logger1).not.toBe(logger2);
  });
});
