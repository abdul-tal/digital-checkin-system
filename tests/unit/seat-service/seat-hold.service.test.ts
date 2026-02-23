import { SeatHoldService } from '../../../src/seat-service/services/seat-hold.service';
import { SeatRepository } from '../../../src/seat-service/repositories/seat.repository';
import { SeatCacheService } from '../../../src/seat-service/services/seat-cache.service';
import { SeatPublisher } from '../../../src/seat-service/events/publishers/seat.publisher';
import { SeatState } from '../../../src/shared/types/common.types';
import mongoose from 'mongoose';

jest.mock('../../../src/seat-service/repositories/seat.repository');
jest.mock('../../../src/seat-service/services/seat-cache.service');
jest.mock('../../../src/seat-service/events/publishers/seat.publisher');

describe('SeatHoldService', () => {
  let seatHoldService: SeatHoldService;
  let mockSeatRepository: jest.Mocked<SeatRepository>;
  let mockCacheService: jest.Mocked<SeatCacheService>;
  let mockEventPublisher: jest.Mocked<SeatPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSeatRepository = new SeatRepository() as jest.Mocked<SeatRepository>;
    mockCacheService = new SeatCacheService(null as any) as jest.Mocked<SeatCacheService>;
    mockEventPublisher = new SeatPublisher(null as any) as jest.Mocked<SeatPublisher>;
    
    seatHoldService = new SeatHoldService(
      mockSeatRepository,
      mockCacheService,
      mockEventPublisher
    );
  });

  describe('holdSeat', () => {
    it('should successfully hold an available seat', async () => {
      const mockSeat = {
        _id: 'seat123',
        seatId: '10A',
        flightId: 'SK123',
        state: SeatState.HELD,
        heldByPassengerId: 'P12345',
        holdExpiresAt: new Date(),
      };

      const mockSession = {
        withTransaction: jest.fn(async (callback) => {
          return await callback();
        }),
        endSession: jest.fn(),
      };

      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);
      mockSeatRepository.findOneAndUpdate.mockResolvedValue(mockSeat as any);
      mockCacheService.invalidateSeatMap.mockResolvedValue(undefined);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      const result = await seatHoldService.holdSeat({
        flightId: 'SK123',
        seatId: '10A',
        passengerId: 'P12345',
      });

      expect(result).toHaveProperty('holdId');
      expect(result.seatId).toBe('10A');
      expect(result).toHaveProperty('expiresAt');
      expect(mockSeatRepository.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          seatId: '10A',
          flightId: 'SK123',
          state: SeatState.AVAILABLE,
        }),
        expect.any(Object),
        expect.any(Object)
      );
      expect(mockCacheService.invalidateSeatMap).toHaveBeenCalledWith('SK123');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('seat.held', expect.any(Object));
    });

    it('should throw error if seat is not available', async () => {
      const mockSession = {
        withTransaction: jest.fn(async (callback) => {
          return await callback();
        }),
        endSession: jest.fn(),
      };

      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);
      mockSeatRepository.findOneAndUpdate.mockResolvedValue(null);
      mockSeatRepository.find.mockResolvedValue([
        { seatId: '10B', seatType: 'WINDOW' },
        { seatId: '10C', seatType: 'AISLE' },
      ] as any);

      await expect(
        seatHoldService.holdSeat({
          flightId: 'SK123',
          seatId: '10A',
          passengerId: 'P12345',
        })
      ).rejects.toThrow();
    });

    it('should provide alternative seats when requested seat unavailable', async () => {
      const mockSession = {
        withTransaction: jest.fn(async (callback) => {
          return await callback();
        }),
        endSession: jest.fn(),
      };

      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);
      mockSeatRepository.findOneAndUpdate.mockResolvedValue(null);
      mockSeatRepository.find.mockResolvedValue([
        { seatId: '10B', seatType: 'WINDOW' },
        { seatId: '10C', seatType: 'AISLE' },
      ] as any);

      await expect(
        seatHoldService.holdSeat({
          flightId: 'SK123',
          seatId: '10A',
          passengerId: 'P12345',
        })
      ).rejects.toThrow();

      expect(mockSeatRepository.find).toHaveBeenCalled();
    });
  });

  describe('releaseSeat', () => {
    it('should successfully release a held seat', async () => {
      const mockSeat = {
        seatId: '10A',
        flightId: 'SK123',
        state: SeatState.AVAILABLE,
      };

      const mockSession = {
        withTransaction: jest.fn(async (callback) => {
          return await callback();
        }),
        endSession: jest.fn(),
      };

      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);
      mockSeatRepository.findOneAndUpdate.mockResolvedValue(mockSeat as any);
      mockCacheService.invalidateSeatMap.mockResolvedValue(undefined);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      await seatHoldService.releaseSeat('10A', 'SK123');

      expect(mockSeatRepository.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          seatId: '10A',
          flightId: 'SK123',
          state: { $in: [SeatState.HELD, SeatState.CONFIRMED] },
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            state: SeatState.AVAILABLE,
          }),
        }),
        expect.any(Object)
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('seat.released', expect.any(Object));
    });

    it('should throw error if seat is not held', async () => {
      const mockSession = {
        withTransaction: jest.fn(async (callback) => {
          return await callback();
        }),
        endSession: jest.fn(),
      };

      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);
      mockSeatRepository.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        seatHoldService.releaseSeat('10A', 'SK123')
      ).rejects.toThrow('Seat not found or already released');
    });
  });

  describe('confirmSeat', () => {
    it('should successfully confirm a held seat', async () => {
      const mockSeatCheck = {
        seatId: '10A',
        flightId: 'SK123',
        state: SeatState.HELD,
        heldByPassengerId: 'P12345',
      };

      const mockSeat = {
        seatId: '10A',
        flightId: 'SK123',
        state: SeatState.CONFIRMED,
        confirmedByPassengerId: 'P12345',
      };

      const mockSession = {
        withTransaction: jest.fn(async (callback) => {
          return await callback();
        }),
        endSession: jest.fn(),
      };

      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);
      mockSeatRepository.findOne.mockResolvedValue(mockSeatCheck as any);
      mockSeatRepository.findOneAndUpdate.mockResolvedValue(mockSeat as any);
      mockCacheService.invalidateSeatMap.mockResolvedValue(undefined);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      await seatHoldService.confirmSeat('10A', 'SK123', 'P12345');

      expect(mockSeatRepository.findOne).toHaveBeenCalledWith(
        { seatId: '10A', flightId: 'SK123' },
        expect.any(Object)
      );
      expect(mockSeatRepository.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          seatId: '10A',
          flightId: 'SK123',
          state: SeatState.HELD,
          heldByPassengerId: 'P12345',
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            state: SeatState.CONFIRMED,
            confirmedByPassengerId: 'P12345',
          }),
        }),
        expect.any(Object)
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('seat.confirmed', expect.any(Object));
    });

    it('should throw error if seat not found', async () => {
      const mockSession = {
        withTransaction: jest.fn(async (callback) => {
          return await callback();
        }),
        endSession: jest.fn(),
      };

      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);
      mockSeatRepository.findOne.mockResolvedValue(null);

      await expect(
        seatHoldService.confirmSeat('10A', 'SK123', 'P12345')
      ).rejects.toThrow('Seat 10A not found');
    });

    it('should throw error if seat not in HELD state', async () => {
      const mockSeat = {
        seatId: '10A',
        flightId: 'SK123',
        state: SeatState.AVAILABLE,
        heldByPassengerId: null,
      };

      const mockSession = {
        withTransaction: jest.fn(async (callback) => {
          return await callback();
        }),
        endSession: jest.fn(),
      };

      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);
      mockSeatRepository.findOne.mockResolvedValue(mockSeat as any);

      await expect(
        seatHoldService.confirmSeat('10A', 'SK123', 'P12345')
      ).rejects.toThrow('Seat 10A is AVAILABLE, cannot confirm');
    });
  });

});
