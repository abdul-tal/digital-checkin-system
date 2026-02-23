import { WaitlistRepository } from '../../../src/waitlist-service/repositories/waitlist.repository';
import { Waitlist } from '../../../src/shared/models/waitlist.model';
import { LoyaltyTier } from '../../../src/shared/types/common.types';

jest.mock('../../../src/shared/models/waitlist.model');

describe('WaitlistRepository', () => {
  let repository: WaitlistRepository;

  beforeEach(() => {
    repository = new WaitlistRepository();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new waitlist entry', async () => {
      const mockSave = jest.fn().mockResolvedValue(undefined);
      const mockWaitlist = {
        waitlistId: 'wl_123',
        passengerId: 'P12345',
        seatId: '12A',
        save: mockSave,
      };

      (Waitlist as any).mockImplementation(() => mockWaitlist);

      const data = {
        waitlistId: 'wl_123',
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '12A',
        priorityScore: 300,
        loyaltyTier: LoyaltyTier.GOLD,
        expiresAt: new Date(),
        createdAt: new Date(),
      };

      const result = await repository.create(data);

      expect(result).toBeDefined();
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should find waitlist entry by filter', async () => {
      const mockEntry = {
        waitlistId: 'wl_123',
        passengerId: 'P12345',
        seatId: '12A',
      };

      const mockExec = jest.fn().mockResolvedValue(mockEntry);
      const mockSession = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockQuery = {
        sort: mockSort,
        session: mockSession,
        exec: mockExec,
      };

      (Waitlist.findOne as jest.Mock) = jest.fn().mockReturnValue(mockQuery);

      const result = await repository.findOne({ waitlistId: 'wl_123' });

      expect(Waitlist.findOne).toHaveBeenCalledWith({ waitlistId: 'wl_123' });
      expect(result).toEqual(mockEntry);
    });

    it('should apply sort option when provided', async () => {
      const mockExec = jest.fn().mockResolvedValue(null);
      const mockSession = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockQuery = {
        sort: mockSort,
        session: mockSession,
        exec: mockExec,
      };

      (Waitlist.findOne as jest.Mock) = jest.fn().mockReturnValue(mockQuery);

      await repository.findOne(
        { seatId: '12A' },
        { sort: { priorityScore: -1 } }
      );

      expect(mockSort).toHaveBeenCalledWith({ priorityScore: -1 });
    });
  });

  describe('find', () => {
    it('should find all matching waitlist entries', async () => {
      const mockEntries = [
        { waitlistId: 'wl_1', seatId: '12A' },
        { waitlistId: 'wl_2', seatId: '12A' },
      ];

      (Waitlist.find as jest.Mock) = jest.fn().mockResolvedValue(mockEntries);

      const result = await repository.find({ seatId: '12A' });

      expect(Waitlist.find).toHaveBeenCalledWith({ seatId: '12A' });
      expect(result).toEqual(mockEntries);
    });
  });

  describe('deleteOne', () => {
    it('should delete waitlist entry', async () => {
      const mockSession = jest.fn().mockResolvedValue(undefined);
      const mockDeleteOne = {
        session: mockSession,
      };

      (Waitlist.deleteOne as jest.Mock) = jest.fn().mockReturnValue(mockDeleteOne);

      await repository.deleteOne({ waitlistId: 'wl_123' });

      expect(Waitlist.deleteOne).toHaveBeenCalledWith({ waitlistId: 'wl_123' });
    });
  });

  describe('countDocuments', () => {
    it('should count matching documents', async () => {
      (Waitlist.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(5);

      const count = await repository.countDocuments({ seatId: '12A' });

      expect(count).toBe(5);
      expect(Waitlist.countDocuments).toHaveBeenCalledWith({ seatId: '12A' });
    });
  });

  describe('deleteExpired', () => {
    it('should delete expired entries and return count', async () => {
      const mockResult = { deletedCount: 3 };
      (Waitlist.deleteMany as jest.Mock) = jest.fn().mockResolvedValue(mockResult);

      const count = await repository.deleteExpired();

      expect(count).toBe(3);
      expect(Waitlist.deleteMany).toHaveBeenCalledWith({
        expiresAt: { $lte: expect.any(Date) },
      });
    });

    it('should return 0 when no expired entries', async () => {
      (Waitlist.deleteMany as jest.Mock) = jest.fn().mockResolvedValue({ deletedCount: 0 });

      const count = await repository.deleteExpired();

      expect(count).toBe(0);
    });
  });
});
