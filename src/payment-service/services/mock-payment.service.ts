import { v4 as uuid } from 'uuid';
import { PaymentRepository } from '../repositories/payment.repository';
import { PaymentPublisher } from '../events/publishers/payment.publisher';
import { createLogger } from '../../shared/utils/logger';
import { AppError } from '../../shared/errors/app-error';

const logger = createLogger('mock-payment-service');

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

export interface PaymentConfirmation {
  status: 'COMPLETED' | 'FAILED';
  transactionId?: string;
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export class MockPaymentService {
  private readonly delay: number;
  private readonly successRate: number;
  private readonly expiryMinutes: number;

  constructor(
    private paymentRepository: PaymentRepository,
    private eventPublisher: PaymentPublisher
  ) {
    this.delay = parseInt(process.env.MOCK_PAYMENT_DELAY_MS || '1000');
    this.successRate = parseFloat(process.env.MOCK_PAYMENT_SUCCESS_RATE || '1.0');
    this.expiryMinutes = parseInt(process.env.PAYMENT_EXPIRY_MINUTES || '30');
  }

  async initiatePayment(req: InitiatePaymentRequest): Promise<PaymentResponse> {
    if (req.amount <= 0) {
      throw new AppError(400, 'INVALID_AMOUNT', 'Payment amount must be positive');
    }

    const paymentId = `pay_${uuid()}`;
    const expiresAt = new Date(Date.now() + this.expiryMinutes * 60 * 1000);

    const paymentUrl = `${process.env.PAYMENT_BASE_URL || 'http://localhost:3003'}/pay/${paymentId}`;

    await this.paymentRepository.create({
      paymentId,
      checkInId: req.checkInId,
      passengerId: req.passengerId,
      amount: req.amount,
      status: PaymentStatus.PENDING,
      expiresAt,
      createdAt: new Date(),
    });

    logger.info('Payment initiated', {
      paymentId,
      amount: req.amount,
      checkInId: req.checkInId,
    });

    return {
      paymentId,
      paymentUrl,
      expiresAt,
    };
  }

  async confirmPayment(paymentId: string): Promise<PaymentConfirmation> {
    const payment = await this.paymentRepository.findById(paymentId);

    if (!payment) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new AppError(
        400,
        'PAYMENT_ALREADY_PROCESSED',
        `Payment already ${payment.status.toLowerCase()}`
      );
    }

    if (new Date() > payment.expiresAt) {
      await this.paymentRepository.updateOne(
        { paymentId },
        { $set: { status: PaymentStatus.EXPIRED } }
      );
      throw new AppError(400, 'PAYMENT_EXPIRED', 'Payment link has expired');
    }

    await this.sleep(this.delay);

    const success = Math.random() < this.successRate;
    const status = success ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;
    const transactionId = success ? `txn_${uuid()}` : undefined;

    await this.paymentRepository.updateOne(
      { paymentId },
      {
        $set: {
          status,
          transactionId,
          completedAt: new Date(),
        },
      }
    );

    logger.info('Payment processed', {
      paymentId,
      status,
      transactionId,
      amount: payment.amount,
    });

    if (success) {
      await this.eventPublisher.publish('payment.confirmed', {
        paymentId,
        checkInId: payment.checkInId,
        passengerId: payment.passengerId,
        amount: payment.amount,
        transactionId,
      });
    } else {
      await this.eventPublisher.publish('payment.failed', {
        paymentId,
        checkInId: payment.checkInId,
      });
    }

    return {
      status: status as 'COMPLETED' | 'FAILED',
      transactionId,
    };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    const payment = await this.paymentRepository.findById(paymentId);

    if (!payment) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    }

    return payment.status as PaymentStatus;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
