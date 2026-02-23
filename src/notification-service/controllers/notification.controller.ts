import { Request, Response, NextFunction } from 'express';
import { NotificationDispatcherService } from '../services/notification-dispatcher.service';

export class NotificationController {
  constructor(private dispatcher: NotificationDispatcherService) {}

  send = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { passengerId, type, channels, data } = req.body;

      await this.dispatcher.send({
        passengerId,
        type,
        channels,
        data,
      });

      res.json({
        message: 'Notification sent successfully',
        passengerId,
        channels,
      });
    } catch (error) {
      next(error);
    }
  };
}
