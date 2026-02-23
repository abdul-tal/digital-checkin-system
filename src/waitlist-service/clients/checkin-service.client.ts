import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('checkin-service-client');

export interface CompleteCheckInRequest {
  checkInId: string;
  passengerId: string;
  userId: string;
  seatId: string;
  baggage: {
    count: number;
    weights?: number[];
  };
}

export interface CompleteCheckInResponse {
  checkInId: string;
  state: string;
  boardingPass?: {
    passengerId: string;
    flightId: string;
    seatNumber: string;
    boardingGroup: string;
    qrCode: string;
  };
  baggageFee?: number;
  paymentUrl?: string;
  expiresAt?: Date;
}

export class CheckInServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.CHECKIN_SERVICE_URL || 'http://localhost:3002',
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async completeCheckIn(req: CompleteCheckInRequest): Promise<CompleteCheckInResponse> {
    try {
      logger.info('Completing check-in from waitlist', {
        checkInId: req.checkInId,
        seatId: req.seatId,
      });

      const response = await this.client.post('/api/v1/checkin/complete', req);

      logger.info('Check-in completed successfully', {
        checkInId: req.checkInId,
        state: response.data.state,
      });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to complete check-in', {
        error: error.message,
        checkInId: req.checkInId,
      });
      throw error;
    }
  }

  async getCheckInStatus(checkInId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/v1/checkin/${checkInId}`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get check-in status', {
        error: error.message,
        checkInId,
      });
      throw error;
    }
  }
}
