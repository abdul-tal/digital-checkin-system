import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('weight-service-client');

export interface WeighBagResponse {
  bagId: string;
  weight: number;
  measuredAt: Date;
}

export class WeightServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.WEIGHT_SERVICE_URL || 'http://localhost:3006',
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async weighBag(bagId: string): Promise<number> {
    try {
      const response = await this.client.post('/api/v1/baggage/weigh', { bagId });
      return response.data.weight;
    } catch (error: any) {
      logger.error('Failed to weigh bag', { error: error.message });
      return 0;
    }
  }
}
