import { Response, NextFunction } from 'express';
import { createAuthMiddleware, AuthRequest } from '../../../src/api-gateway/middleware/authentication.middleware';
import { AuthService } from '../../../src/api-gateway/services/auth.service';
import { AppError } from '../../../src/shared/errors/app-error';

describe('Authentication Middleware', () => {
  let mockAuthService: jest.Mocked<AuthService>;
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let authMiddleware: ReturnType<typeof createAuthMiddleware>;

  beforeEach(() => {
    mockAuthService = {
      verifyToken: jest.fn(),
      generateToken: jest.fn(),
      login: jest.fn(),
    } as any;

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();

    authMiddleware = createAuthMiddleware(mockAuthService);
  });

  describe('valid token', () => {
    it('should attach user info to request for valid Bearer token', () => {
      const mockPayload = {
        userId: 'U_test',
        role: 'passenger',
        loyaltyTier: 'GOLD',
        permissions: ['book:seat', 'cancel:checkin'],
      };

      mockRequest.headers = {
        authorization: 'Bearer valid.jwt.token',
      };

      mockAuthService.verifyToken.mockReturnValue(mockPayload as any);

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid.jwt.token');
      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should extract token correctly from Bearer scheme', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockAuthService.verifyToken.mockReturnValue({
        userId: 'U_test',
        role: 'passenger',
        permissions: [],
      } as any);

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith(token);
    });
  });

  describe('missing or invalid authorization', () => {
    it('should call next with error when Authorization header is missing', () => {
      mockRequest.headers = {};

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        })
      );
    });

    it('should call next with error when Bearer scheme is missing', () => {
      mockRequest.headers = {
        authorization: 'InvalidScheme token',
      };

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        })
      );
    });

    it('should call next with error when token is empty', () => {
      mockRequest.headers = {
        authorization: 'Bearer ',
      };

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        })
      );
    });

    it('should call next with error when only "Bearer" is provided', () => {
      mockRequest.headers = {
        authorization: 'Bearer',
      };

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        })
      );
    });
  });

  describe('invalid token', () => {
    it('should call next with error when token verification fails', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.token',
      };

      const verifyError = new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token');
      mockAuthService.verifyToken.mockImplementation(() => {
        throw verifyError;
      });

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(verifyError);
      expect(mockRequest.user).toBeUndefined();
    });

    it('should not attach user to request when verification fails', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.token',
      };

      mockAuthService.verifyToken.mockImplementation(() => {
        throw new Error('Verification failed');
      });

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
    });
  });

  describe('user context', () => {
    it('should attach all required user fields', () => {
      const mockPayload = {
        userId: 'U_test123',
        role: 'staff',
        loyaltyTier: 'PLATINUM',
        permissions: ['book:seat', 'cancel:checkin', 'join:waitlist'],
      };

      mockRequest.headers = {
        authorization: 'Bearer valid.token',
      };

      mockAuthService.verifyToken.mockReturnValue(mockPayload as any);

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual({
        userId: 'U_test123',
        role: 'staff',
        loyaltyTier: 'PLATINUM',
        permissions: ['book:seat', 'cancel:checkin', 'join:waitlist'],
      });
    });

    it('should handle user without loyalty tier', () => {
      const mockPayload = {
        userId: 'U_admin',
        role: 'admin',
        permissions: ['*'],
      };

      mockRequest.headers = {
        authorization: 'Bearer admin.token',
      };

      mockAuthService.verifyToken.mockReturnValue(mockPayload as any);

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual({
        userId: 'U_admin',
        role: 'admin',
        loyaltyTier: undefined,
        permissions: ['*'],
      });
    });
  });
});
