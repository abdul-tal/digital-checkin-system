import jwt from 'jsonwebtoken';
import { createLogger } from '../../shared/utils/logger';
import { UnauthorizedError } from '../../shared/errors/app-error';

const logger = createLogger('auth-service');

export interface JWTPayload {
  userId: string;
  role: 'passenger' | 'staff' | 'admin';
  loyaltyTier?: 'PLATINUM' | 'GOLD' | 'SILVER' | 'REGULAR';
  permissions: string[];
  iat?: number;
  exp?: number;
}

export class AuthService {
  private readonly secret: string;
  private readonly expiresIn: string | number;

  constructor() {
    this.secret = process.env.JWT_SECRET || 'your-secret-key';
    this.expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  }

  generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    const token = jwt.sign(
      payload as any,
      this.secret,
      {
        expiresIn: this.expiresIn,
        issuer: 'skyhigh-core',
        audience: 'skyhigh-api',
      } as jwt.SignOptions
    );

    logger.info('Token generated', { userId: payload.userId, role: payload.role });

    return token;
  }

  verifyToken(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, this.secret, {
        issuer: 'skyhigh-core',
        audience: 'skyhigh-api',
      }) as JWTPayload;

      return payload;
    } catch (error: any) {
      logger.warn('Token verification failed', { error: error.message });
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  async login(email: string, _password: string): Promise<{ token: string; user: any }> {
    const user = {
      userId: `U_${email.split('@')[0]}`,
      email,
      role: 'passenger' as const,
      loyaltyTier: 'GOLD' as const,
    };

    const token = this.generateToken({
      userId: user.userId,
      role: user.role,
      loyaltyTier: user.loyaltyTier,
      permissions: ['book:seat', 'cancel:checkin', 'join:waitlist'],
    });

    logger.info('User logged in', { userId: user.userId, email });

    return { token, user };
  }
}
