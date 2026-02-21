import { Payment, IPayment } from '../../shared/models/payment.model';
import { FilterQuery, UpdateQuery } from 'mongoose';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('payment-repository');

export class PaymentRepository {
  async create(data: Partial<IPayment>): Promise<IPayment> {
    const payment = new Payment(data);
    await payment.save();
    logger.debug('Payment created', { paymentId: payment.paymentId });
    return payment;
  }

  async findOne(filter: FilterQuery<IPayment>): Promise<IPayment | null> {
    return Payment.findOne(filter);
  }

  async findById(paymentId: string): Promise<IPayment | null> {
    return Payment.findOne({ paymentId });
  }

  async updateOne(
    filter: FilterQuery<IPayment>,
    update: UpdateQuery<IPayment>
  ): Promise<void> {
    await Payment.updateOne(filter, update);
    logger.debug('Payment updated', { filter });
  }
}
