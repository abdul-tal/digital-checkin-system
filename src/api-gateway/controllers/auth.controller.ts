import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { ValidationError } from '../../shared/errors/app-error';

export class AuthController {
  constructor(private authService: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new ValidationError('Email and password are required');
      }

      const result = await this.authService.login(email, password);

      res.json({
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (_req: Request, res: Response, _next: NextFunction) => {
    res.json({ message: 'Logged out successfully' });
  };
}
