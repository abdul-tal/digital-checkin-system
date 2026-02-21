import { SeatRepository } from '../repositories/seat.repository';
import { SeatCacheService } from './seat-cache.service';
import { SeatState, SeatType } from '../../shared/types/common.types';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('seat-management-service');

export interface SeatMapResponse {
  flightId: string;
  aircraft: string;
  totalSeats: number;
  availableSeats: number;
  seats: SeatInfo[];
  cachedAt?: string;
}

export interface SeatInfo {
  seatId: string;
  row: number;
  column: string;
  state: 'AVAILABLE' | 'UNAVAILABLE';
  type: SeatType;
  price: number;
}

export class SeatManagementService {
  constructor(
    private seatRepository: SeatRepository,
    private cacheService: SeatCacheService
  ) {}

  async getSeatMap(flightId: string): Promise<SeatMapResponse> {
    // 1. Check cache first
    const cached = await this.cacheService.getSeatMap(flightId);
    if (cached) {
      logger.info('Seat map served from cache', { flightId });
      return cached;
    }

    // 2. Fetch from database
    const seats = await this.seatRepository.find({ flightId });

    if (seats.length === 0) {
      throw new Error('Flight not found or no seats available');
    }

    // 3. Transform to response format (hide held/confirmed details from others)
    const seatMap: SeatMapResponse = {
      flightId,
      aircraft: 'Boeing 737',
      totalSeats: seats.length,
      availableSeats: seats.filter((s) => s.state === SeatState.AVAILABLE).length,
      seats: seats.map((seat) => ({
        seatId: seat.seatId,
        row: seat.rowNumber,
        column: seat.columnLetter,
        state: seat.state === SeatState.AVAILABLE ? 'AVAILABLE' : 'UNAVAILABLE',
        type: seat.seatType as SeatType,
        price: seat.price,
      })),
    };

    // 4. Cache the result
    await this.cacheService.setSeatMap(flightId, seatMap);

    logger.info('Seat map fetched from database', { flightId, totalSeats: seats.length });

    return seatMap;
  }

  async getSeatDetails(seatId: string, flightId: string, passengerId?: string) {
    const seat = await this.seatRepository.findOne({ seatId, flightId });

    if (!seat) {
      throw new Error('Seat not found');
    }

    // If seat is held/confirmed by this passenger, show full details
    if (
      passengerId &&
      (seat.heldByPassengerId === passengerId || seat.confirmedByPassengerId === passengerId)
    ) {
      return seat;
    }

    // Otherwise, hide sensitive info
    return {
      seatId: seat.seatId,
      flightId: seat.flightId,
      row: seat.rowNumber,
      column: seat.columnLetter,
      type: seat.seatType,
      state: seat.state === SeatState.AVAILABLE ? 'AVAILABLE' : 'UNAVAILABLE',
      price: seat.price,
    };
  }
}
