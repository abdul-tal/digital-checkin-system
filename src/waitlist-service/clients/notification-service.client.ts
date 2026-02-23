import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('notification-service-client');

export interface SendNotificationRequest {
  passengerId: string;
  type: string;
  channels: string[];
  data: Record<string, any>;
}

export class NotificationServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async send(req: SendNotificationRequest): Promise<void> {
    try {
      await this.client.post('/api/v1/notifications/send', req);
      logger.info('Notification sent', { passengerId: req.passengerId, type: req.type });
    } catch (error: any) {
      logger.error('Failed to send notification', { error: error.message });
    }
  }
}
