import { Response } from 'express';
import { requireRole, requirePermission } from '../../../src/api-gateway/middleware/authorization.middleware';
import { AuthRequest } from '../../../src/api-gateway/middleware/authentication.middleware';
import { AppError } from '../../../src/shared/errors/app-error';

describe('Authorization Middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock<any, any>;

  beforeEach(() => {
    mockRequest = {
      user: {
        userId: 'U_test',
        role: 'passenger',
        loyaltyTier: 'GOLD',
        permissions: ['book:seat', 'cancel:checkin'],
      },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn() as any;
  });

  describe('requireRole', () => {
    it('should call next() when user has required role', () => {
      const middleware = requireRole('passenger');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next() when user has one of multiple allowed roles', () => {
      const middleware = requireRole('passenger', 'staff', 'admin');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next with ForbiddenError when user lacks required role', () => {
      const middleware = requireRole('admin');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        })
      );
    });

    it('should call next with ForbiddenError when user is not authenticated', () => {
      mockRequest.user = undefined;
      const middleware = requireRole('passenger');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Authentication required',
        })
      );
    });

    it('should handle staff role correctly', () => {
      mockRequest.user!.role = 'staff';
      const middleware = requireRole('staff');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle admin role correctly', () => {
      mockRequest.user!.role = 'admin';
      const middleware = requireRole('admin');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requirePermission', () => {
    it('should call next() when user has required permission', () => {
      const middleware = requirePermission('book:seat');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next() when user has one of multiple required permissions', () => {
      const middleware = requirePermission('book:seat', 'cancel:checkin', 'join:waitlist');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next with ForbiddenError when user lacks all required permissions', () => {
      const middleware = requirePermission('admin:access', 'system:config');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Requires one of: admin:access, system:config',
        })
      );
    });

    it('should call next with ForbiddenError when user is not authenticated', () => {
      mockRequest.user = undefined;
      const middleware = requirePermission('book:seat');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Authentication required',
        })
      );
    });

    it('should handle empty permissions array', () => {
      mockRequest.user!.permissions = [];
      const middleware = requirePermission('book:seat');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'FORBIDDEN',
        })
      );
    });

    it('should handle single permission requirement', () => {
      mockRequest.user!.permissions = ['cancel:checkin'];
      const middleware = requirePermission('cancel:checkin');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should be case-sensitive for permission matching', () => {
      mockRequest.user!.permissions = ['book:seat'];
      const middleware = requirePermission('BOOK:SEAT');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'FORBIDDEN',
        })
      );
    });
  });

  describe('combined authorization', () => {
    it('should work with both role and permission checks', () => {
      const roleMiddleware = requireRole('passenger');
      const permMiddleware = requirePermission('book:seat');

      roleMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();

      mockNext.mockClear();

      permMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
