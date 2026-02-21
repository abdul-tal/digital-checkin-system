import { BoardingPassService } from '../../../src/checkin-service/services/boarding-pass.service';

jest.mock('qrcode');

describe('BoardingPassService', () => {
  let boardingPassService: BoardingPassService;

  beforeEach(() => {
    jest.clearAllMocks();
    boardingPassService = new BoardingPassService();
  });

  describe('generate', () => {
    it('should generate boarding pass with QR code', async () => {
      const mockQRCode = 'data:image/png;base64,mockQRCode';
      const QRCode = require('qrcode');
      QRCode.toDataURL = jest.fn().mockResolvedValue(mockQRCode);

      const result = await boardingPassService.generate({
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '10A',
      });

      expect(result).toEqual({
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '10A',
        gate: 'B12',
        boardingTime: expect.any(Date),
        qrCode: mockQRCode,
      });
      expect(QRCode.toDataURL).toHaveBeenCalled();
    });

    it('should use provided gate if specified', async () => {
      const QRCode = require('qrcode');
      QRCode.toDataURL = jest.fn().mockResolvedValue('mock');

      const result = await boardingPassService.generate({
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '10A',
        gate: 'A5',
      });

      expect(result.gate).toBe('A5');
    });

    it('should use provided boarding time if specified', async () => {
      const QRCode = require('qrcode');
      QRCode.toDataURL = jest.fn().mockResolvedValue('mock');

      const customTime = new Date('2026-03-01T10:00:00Z');
      const result = await boardingPassService.generate({
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '10A',
        boardingTime: customTime,
      });

      expect(result.boardingTime).toEqual(customTime);
    });

    it('should generate QR code with correct data structure', async () => {
      const QRCode = require('qrcode');
      QRCode.toDataURL = jest.fn().mockImplementation((data) => {
        const parsedData = JSON.parse(data);
        expect(parsedData).toHaveProperty('passengerId');
        expect(parsedData).toHaveProperty('flightId');
        expect(parsedData).toHaveProperty('seatId');
        expect(parsedData).toHaveProperty('gate');
        expect(parsedData).toHaveProperty('boardingTime');
        expect(parsedData).toHaveProperty('issuedAt');
        return Promise.resolve('mock');
      });

      await boardingPassService.generate({
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '10A',
      });

      expect(QRCode.toDataURL).toHaveBeenCalled();
    });

    it('should set default boarding time 4 hours from now', async () => {
      const QRCode = require('qrcode');
      QRCode.toDataURL = jest.fn().mockResolvedValue('mock');

      const beforeTime = Date.now() + 4 * 60 * 60 * 1000 - 1000;
      const result = await boardingPassService.generate({
        passengerId: 'P12345',
        flightId: 'SK123',
        seatId: '10A',
      });
      const afterTime = Date.now() + 4 * 60 * 60 * 1000 + 1000;

      const boardingTime = result.boardingTime.getTime();
      expect(boardingTime).toBeGreaterThan(beforeTime);
      expect(boardingTime).toBeLessThan(afterTime);
    });
  });
});
