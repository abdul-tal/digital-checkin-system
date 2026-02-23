import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('seat-service-client');

export interface HoldSeatRequest {
  flightId: string;
  seatId: string;
  passengerId: string;
  duration?: number;
}

export interface HoldSeatResponse {
  holdId: string;
  seatId: string;
  expiresAt: Date;
  remainingSeconds: number;
}

export class SeatServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.SEAT_SERVICE_URL || 'http://localhost:3001',
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async holdSeat(req: HoldSeatRequest): Promise<HoldSeatResponse> {
    try {
      const response = await this.client.post('/api/v1/seats/hold', req);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to hold seat', { error: error.message });
      throw error;
    }
  }

  async confirmSeat(seatId: string, flightId: string, passengerId: string): Promise<void> {
    try {
      await this.client.post('/api/v1/seats/confirm', {
        seatId,
        flightId,
        passengerId,
      });
    } catch (error: any) {
      logger.error('Failed to confirm seat', { error: error.message });
      throw error;
    }
  }

  async releaseSeat(seatId: string, flightId: string): Promise<void> {
    try {
      await this.client.post('/api/v1/seats/release', { seatId, flightId });
    } catch (error: any) {
      logger.error('Failed to release seat', { error: error.message });
      throw error;
    }
  }
}
