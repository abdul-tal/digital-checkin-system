import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('payment-service-client');

export interface InitiatePaymentRequest {
  amount: number;
  passengerId: string;
  checkInId: string;
}

export interface PaymentResponse {
  paymentId: string;
  paymentUrl: string;
  expiresAt: Date;
}

export class PaymentServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003',
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async initiatePayment(req: InitiatePaymentRequest): Promise<PaymentResponse> {
    try {
      const response = await this.client.post('/api/v1/payments/initiate', req);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to initiate payment', { error: error.message });
      throw error;
    }
  }

  async getPaymentStatus(paymentId: string): Promise<string> {
    try {
      const response = await this.client.get(`/api/v1/payments/${paymentId}/status`);
      return response.data.status;
    } catch (error: any) {
      logger.error('Failed to get payment status', { error: error.message });
      throw error;
    }
  }
}
