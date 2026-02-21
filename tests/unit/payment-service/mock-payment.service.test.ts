import { MockPaymentService, PaymentStatus } from '../../../src/payment-service/services/mock-payment.service';
import { PaymentRepository } from '../../../src/payment-service/repositories/payment.repository';
import { PaymentPublisher } from '../../../src/payment-service/events/publishers/payment.publisher';
import { AppError } from '../../../src/shared/errors/app-error';

jest.mock('../../../src/payment-service/repositories/payment.repository');
jest.mock('../../../src/payment-service/events/publishers/payment.publisher');

describe('MockPaymentService', () => {
  let paymentService: MockPaymentService;
  let mockRepository: jest.Mocked<PaymentRepository>;
  let mockPublisher: jest.Mocked<PaymentPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    process.env.MOCK_PAYMENT_DELAY_MS = '10';
    process.env.MOCK_PAYMENT_SUCCESS_RATE = '1.0';
    process.env.PAYMENT_EXPIRY_MINUTES = '30';
    
    mockRepository = new PaymentRepository() as jest.Mocked<PaymentRepository>;
    mockPublisher = new PaymentPublisher(null as any) as jest.Mocked<PaymentPublisher>;
    
    paymentService = new MockPaymentService(mockRepository, mockPublisher);
  });

  describe('initiatePayment', () => {
    it('should create payment with correct details', async () => {
      mockRepository.create.mockResolvedValue({
        paymentId: 'pay_123',
        amount: 100,
        status: PaymentStatus.PENDING,
      } as any);

      const result = await paymentService.initiatePayment({
        amount: 100,
        passengerId: 'P12345',
        checkInId: 'ci_123',
      });

      expect(result).toEqual({
        paymentId: expect.stringContaining('pay_'),
        paymentUrl: expect.stringContaining('http'),
        expiresAt: expect.any(Date),
      });
      
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: expect.stringContaining('pay_'),
          checkInId: 'ci_123',
          passengerId: 'P12345',
          amount: 100,
          status: PaymentStatus.PENDING,
          expiresAt: expect.any(Date),
        })
      );
    });

    it('should reject payment with negative amount', async () => {
      await expect(
        paymentService.initiatePayment({
          amount: -50,
          passengerId: 'P12345',
          checkInId: 'ci_123',
        })
      ).rejects.toThrow(AppError);
    });

    it('should reject payment with zero amount', async () => {
      await expect(
        paymentService.initiatePayment({
          amount: 0,
          passengerId: 'P12345',
          checkInId: 'ci_123',
        })
      ).rejects.toThrow('Payment amount must be positive');
    });

    it('should set expiry time 30 minutes in future', async () => {
      mockRepository.create.mockResolvedValue({} as any);

      const beforeTime = Date.now() + 30 * 60 * 1000 - 1000;
      await paymentService.initiatePayment({
        amount: 100,
        passengerId: 'P12345',
        checkInId: 'ci_123',
      });
      const afterTime = Date.now() + 30 * 60 * 1000 + 1000;

      const createCall = mockRepository.create.mock.calls[0][0];
      const expiryTime = (createCall as any).expiresAt.getTime();
      
      expect(expiryTime).toBeGreaterThan(beforeTime);
      expect(expiryTime).toBeLessThan(afterTime);
    });
  });

  describe('confirmPayment', () => {
    it('should confirm payment and publish event', async () => {
      mockRepository.findById.mockResolvedValue({
        paymentId: 'pay_123',
        checkInId: 'ci_123',
        passengerId: 'P12345',
        amount: 100,
        status: PaymentStatus.PENDING,
        expiresAt: new Date(Date.now() + 10000),
      } as any);

      mockRepository.updateOne.mockResolvedValue(undefined);
      mockPublisher.publish.mockResolvedValue(undefined);

      const result = await paymentService.confirmPayment('pay_123');

      expect(result.status).toBe('COMPLETED');
      expect(result.transactionId).toMatch(/^txn_/);
      
      expect(mockRepository.updateOne).toHaveBeenCalledWith(
        { paymentId: 'pay_123' },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: PaymentStatus.COMPLETED,
            transactionId: expect.stringContaining('txn_'),
          }),
        })
      );

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'payment.confirmed',
        expect.objectContaining({
          paymentId: 'pay_123',
          checkInId: 'ci_123',
          passengerId: 'P12345',
          amount: 100,
        })
      );
    });

    it('should throw error if payment not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        paymentService.confirmPayment('pay_nonexistent')
      ).rejects.toThrow('Payment not found');
    });

    it('should throw error if payment already processed', async () => {
      mockRepository.findById.mockResolvedValue({
        paymentId: 'pay_123',
        status: PaymentStatus.COMPLETED,
        expiresAt: new Date(Date.now() + 10000),
      } as any);

      await expect(
        paymentService.confirmPayment('pay_123')
      ).rejects.toThrow('Payment already completed');
    });

    it('should throw error if payment expired', async () => {
      mockRepository.findById.mockResolvedValue({
        paymentId: 'pay_123',
        status: PaymentStatus.PENDING,
        expiresAt: new Date(Date.now() - 1000),
      } as any);

      mockRepository.updateOne.mockResolvedValue(undefined);

      await expect(
        paymentService.confirmPayment('pay_123')
      ).rejects.toThrow('Payment link has expired');

      expect(mockRepository.updateOne).toHaveBeenCalledWith(
        { paymentId: 'pay_123' },
        { $set: { status: PaymentStatus.EXPIRED } }
      );
    });

    it('should handle payment failure based on success rate', async () => {
      process.env.MOCK_PAYMENT_SUCCESS_RATE = '0.0';
      const failingService = new MockPaymentService(mockRepository, mockPublisher);

      mockRepository.findById.mockResolvedValue({
        paymentId: 'pay_123',
        checkInId: 'ci_123',
        status: PaymentStatus.PENDING,
        expiresAt: new Date(Date.now() + 10000),
      } as any);

      mockRepository.updateOne.mockResolvedValue(undefined);
      mockPublisher.publish.mockResolvedValue(undefined);

      const result = await failingService.confirmPayment('pay_123');

      expect(result.status).toBe('FAILED');
      expect(result.transactionId).toBeUndefined();
      expect(mockPublisher.publish).toHaveBeenCalledWith('payment.failed', expect.any(Object));
    });
  });

  describe('getPaymentStatus', () => {
    it('should return payment status', async () => {
      mockRepository.findById.mockResolvedValue({
        paymentId: 'pay_123',
        status: PaymentStatus.COMPLETED,
      } as any);

      const status = await paymentService.getPaymentStatus('pay_123');

      expect(status).toBe(PaymentStatus.COMPLETED);
    });

    it('should throw error if payment not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        paymentService.getPaymentStatus('pay_nonexistent')
      ).rejects.toThrow('Payment not found');
    });
  });
});
