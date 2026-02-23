import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { UnauthorizedError } from '../../shared/errors/app-error';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    loyaltyTier?: string;
    permissions: string[];
  };
}

export const createAuthMiddleware = (authService: AuthService) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7).trim();
      
      if (!token) {
        throw new UnauthorizedError('Missing or invalid authorization header');
      }

      const payload = authService.verifyToken(token);

      req.user = {
        userId: payload.userId,
        role: payload.role,
        loyaltyTier: payload.loyaltyTier,
        permissions: payload.permissions,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};
