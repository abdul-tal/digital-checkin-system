import {
  AppError,
  SeatUnavailableError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
} from '../../../src/shared/errors/app-error';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with all properties', () => {
      const error = new AppError(404, 'NOT_FOUND', 'Resource not found');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
      expect(error.isOperational).toBe(true);
      expect(error.stack).toBeDefined();
    });

    it('should allow setting isOperational to false', () => {
      const error = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong', false);

      expect(error.isOperational).toBe(false);
    });

    it('should have proper prototype chain', () => {
      const error = new AppError(400, 'BAD_REQUEST', 'Invalid input');

      expect(Object.getPrototypeOf(error)).toBe(AppError.prototype);
      expect(error.constructor).toBe(AppError);
    });
  });

  describe('SeatUnavailableError', () => {
    it('should create seat unavailable error with suggestions', () => {
      const suggestions = ['10B', '10C', '11A'];
      const error = new SeatUnavailableError(suggestions);

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('SEAT_UNAVAILABLE');
      expect(error.message).toBe('Seat is no longer available');
      expect(error.suggestions).toEqual(suggestions);
    });

    it('should create seat unavailable error without suggestions', () => {
      const error = new SeatUnavailableError();

      expect(error.suggestions).toEqual([]);
    });
  });

  describe('UnauthorizedError', () => {
    it('should create unauthorized error with default message', () => {
      const error = new UnauthorizedError();

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Unauthorized');
    });

    it('should create unauthorized error with custom message', () => {
      const error = new UnauthorizedError('Invalid token');

      expect(error.message).toBe('Invalid token');
    });
  });

  describe('ForbiddenError', () => {
    it('should create forbidden error with default message', () => {
      const error = new ForbiddenError();

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('Forbidden');
    });

    it('should create forbidden error with custom message', () => {
      const error = new ForbiddenError('Access denied to this resource');

      expect(error.message).toBe('Access denied to this resource');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Invalid email format');

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid email format');
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with default message', () => {
      const error = new NotFoundError();

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
    });

    it('should create not found error with custom message', () => {
      const error = new NotFoundError('User not found');

      expect(error.message).toBe('User not found');
    });
  });

  describe('Error serialization', () => {
    it('should have correct properties when caught', () => {
      const error = new AppError(400, 'VALIDATION_ERROR', 'Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should work with try-catch', () => {
      try {
        throw new ValidationError('Test error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AppError);
        expect((error as ValidationError).statusCode).toBe(400);
        expect((error as ValidationError).code).toBe('VALIDATION_ERROR');
      }
    });
  });
});
