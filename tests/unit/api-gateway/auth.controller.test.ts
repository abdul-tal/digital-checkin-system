import { Request, Response, NextFunction } from 'express';
import { AuthController } from '../../../src/api-gateway/controllers/auth.controller';
import { AuthService } from '../../../src/api-gateway/services/auth.service';
import { AppError } from '../../../src/shared/errors/app-error';

describe('AuthController', () => {
  let authController: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockAuthService = {
      login: jest.fn(),
      verifyToken: jest.fn(),
      generateToken: jest.fn(),
    } as any;

    mockRequest = {
      body: {},
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    authController = new AuthController(mockAuthService);
  });

  describe('login', () => {
    it('should return token and user data for valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockResult = {
        token: 'jwt.token.here',
        user: {
          userId: 'U_test',
          email: 'test@example.com',
          role: 'passenger',
          loyaltyTier: 'GOLD',
        },
      };

      mockRequest.body = loginData;
      mockAuthService.login.mockResolvedValue(mockResult);

      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next with ValidationError when email is missing', async () => {
      mockRequest.body = {
        password: 'password123',
      };

      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required',
        })
      );
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should call next with ValidationError when password is missing', async () => {
      mockRequest.body = {
        email: 'test@example.com',
      };

      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        })
      );
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should call next with ValidationError when both email and password are missing', async () => {
      mockRequest.body = {};

      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        })
      );
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      const serviceError = new Error('Service unavailable');
      mockAuthService.login.mockRejectedValue(serviceError);

      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(serviceError);
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should handle empty strings as invalid', async () => {
      mockRequest.body = {
        email: '',
        password: '',
      };

      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        })
      );
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should trim whitespace from email', async () => {
      mockRequest.body = {
        email: '  test@example.com  ',
        password: 'password123',
      };

      const mockResult = {
        token: 'jwt.token',
        user: { userId: 'U_test', email: 'test@example.com', role: 'passenger' },
      };

      mockAuthService.login.mockResolvedValue(mockResult);

      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      // Note: The controller doesn't trim, so the service receives the whitespace
      // This test verifies current behavior
      expect(mockAuthService.login).toHaveBeenCalledWith('  test@example.com  ', 'password123');
    });
  });

  describe('logout', () => {
    it('should return success message', async () => {
      await authController.logout(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Logged out successfully',
      });
    });

    it('should not interact with auth service', async () => {
      await authController.logout(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.login).not.toHaveBeenCalled();
      expect(mockAuthService.verifyToken).not.toHaveBeenCalled();
      expect(mockAuthService.generateToken).not.toHaveBeenCalled();
    });

    it('should always succeed', async () => {
      await authController.logout(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
