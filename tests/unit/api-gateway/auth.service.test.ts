import { AuthService, JWTPayload } from '../../../src/api-gateway/services/auth.service';
import jwt from 'jsonwebtoken';
import { AppError } from '../../../src/shared/errors/app-error';

jest.mock('jsonwebtoken');
jest.mock('../../../src/shared/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('AuthService', () => {
  let authService: AuthService;
  const mockJwtSecret = 'test-secret-key';

  beforeEach(() => {
    process.env.JWT_SECRET = mockJwtSecret;
    process.env.JWT_EXPIRES_IN = '24h';
    authService = new AuthService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const payload = {
        userId: 'U_test',
        role: 'passenger' as const,
        loyaltyTier: 'GOLD' as const,
        permissions: ['book:seat', 'cancel:checkin'],
      };

      const mockToken = 'mock.jwt.token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const token = authService.generateToken(payload);

      expect(token).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        mockJwtSecret,
        expect.objectContaining({
          expiresIn: '24h',
          issuer: 'skyhigh-core',
          audience: 'skyhigh-api',
        })
      );
    });

    it('should use default JWT_SECRET if not provided', () => {
      delete process.env.JWT_SECRET;
      authService = new AuthService();

      const payload = {
        userId: 'U_test',
        role: 'passenger' as const,
        permissions: [],
      };

      authService.generateToken(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.anything(),
        'your-secret-key',
        expect.anything()
      );
    });

    it('should use default expires time if not provided', () => {
      delete process.env.JWT_EXPIRES_IN;
      authService = new AuthService();

      const payload = {
        userId: 'U_test',
        role: 'passenger' as const,
        permissions: [],
      };

      authService.generateToken(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          expiresIn: '24h',
        })
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify and return decoded token payload', () => {
      const mockPayload: JWTPayload = {
        userId: 'U_test',
        role: 'passenger',
        loyaltyTier: 'GOLD',
        permissions: ['book:seat'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      const token = 'valid.jwt.token';
      const result = authService.verifyToken(token);

      expect(result).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalledWith(token, mockJwtSecret, {
        issuer: 'skyhigh-core',
        audience: 'skyhigh-api',
      });
    });

    it('should throw UnauthorizedError for invalid token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const token = 'invalid.jwt.token';

      expect(() => authService.verifyToken(token)).toThrow(AppError);
      expect(() => authService.verifyToken(token)).toThrow('Invalid or expired token');
    });

    it('should throw UnauthorizedError for expired token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        const error: any = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      const token = 'expired.jwt.token';

      expect(() => authService.verifyToken(token)).toThrow(AppError);
    });
  });

  describe('login', () => {
    it('should return token and user data for valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const mockToken = 'generated.jwt.token';

      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await authService.login(email, password);

      expect(result).toHaveProperty('token', mockToken);
      expect(result).toHaveProperty('user');
      expect(result.user).toMatchObject({
        userId: 'U_test',
        email: 'test@example.com',
        role: 'passenger',
        loyaltyTier: 'GOLD',
      });
    });

    it('should extract username from email correctly', async () => {
      const email = 'john.smith@example.com';
      const mockToken = 'mock.token';

      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await authService.login(email, 'password');

      expect(result.user.userId).toBe('U_john.smith');
    });

    it('should generate token with correct permissions', async () => {
      const email = 'user@example.com';
      const mockToken = 'mock.token';

      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      await authService.login(email, 'password');

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: ['book:seat', 'cancel:checkin', 'join:waitlist'],
        }),
        expect.anything(),
        expect.anything()
      );
    });

    it('should assign GOLD loyalty tier by default', async () => {
      const mockToken = 'mock.token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await authService.login('test@example.com', 'password');

      expect(result.user.loyaltyTier).toBe('GOLD');
    });
  });
});
