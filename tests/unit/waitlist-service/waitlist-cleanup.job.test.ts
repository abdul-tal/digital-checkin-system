import { WaitlistCleanupJob } from '../../../src/waitlist-service/jobs/waitlist-cleanup.job';
import { WaitlistRepository } from '../../../src/waitlist-service/repositories/waitlist.repository';

jest.mock('../../../src/waitlist-service/repositories/waitlist.repository');

describe('WaitlistCleanupJob', () => {
  let job: WaitlistCleanupJob;
  let mockRepository: jest.Mocked<WaitlistRepository>;

  beforeEach(() => {
    mockRepository = new WaitlistRepository() as jest.Mocked<WaitlistRepository>;
    job = new WaitlistCleanupJob(mockRepository);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    job.stop();
    jest.useRealTimers();
  });

  describe('start', () => {
    it('should start cleanup job with interval', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      job.start();

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
    });

    it('should run cleanup periodically', async () => {
      mockRepository.deleteExpired.mockResolvedValue(0);

      job.start();

      await jest.advanceTimersByTimeAsync(60000);

      expect(mockRepository.deleteExpired).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(60000);

      expect(mockRepository.deleteExpired).toHaveBeenCalledTimes(2);
    });
  });

  describe('stop', () => {
    it('should stop cleanup job', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      job.start();
      job.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should not throw when stopping without starting', () => {
      expect(() => job.stop()).not.toThrow();
    });
  });

  describe('cleanupExpiredEntries', () => {
    it('should delete expired entries', async () => {
      mockRepository.deleteExpired.mockResolvedValue(5);

      await job.cleanupExpiredEntries();

      expect(mockRepository.deleteExpired).toHaveBeenCalled();
    });

    it('should handle zero deletions', async () => {
      mockRepository.deleteExpired.mockResolvedValue(0);

      await expect(job.cleanupExpiredEntries()).resolves.not.toThrow();
    });

    it('should handle errors gracefully', async () => {
      mockRepository.deleteExpired.mockRejectedValue(new Error('DB error'));

      await expect(job.cleanupExpiredEntries()).rejects.toThrow('DB error');
    });
  });
});
