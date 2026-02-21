import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  paymentId: string;
  checkInId: string;
  passengerId: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  transactionId?: string;
  createdAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    paymentId: { type: String, required: true, unique: true, maxlength: 50 },
    checkInId: { type: String, required: true, maxlength: 50 },
    passengerId: { type: String, required: true, maxlength: 50 },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'EXPIRED'],
      default: 'PENDING',
    },
    transactionId: { type: String, maxlength: 100 },
    completedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

// Indexes
PaymentSchema.index({ paymentId: 1 }, { unique: true });
PaymentSchema.index({ checkInId: 1 });
PaymentSchema.index({ status: 1, expiresAt: 1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
