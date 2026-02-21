import mongoose, { Schema, Document } from 'mongoose';

export interface ICheckIn extends Document {
  checkInId: string;
  userId: string;
  passengerId: string;
  flightId: string;
  seatId?: string;
  state: 'NOT_STARTED' | 'IN_PROGRESS' | 'AWAITING_PAYMENT' | 'COMPLETED' | 'CANCELLED';
  baggage?: {
    count: number;
    weights: number[];
    fee: number;
  };
  paymentUrl?: string;
  boardingPass?: {
    qrCode: string;
    gate: string;
    boardingTime: Date;
  };
  createdAt: Date;
  completedAt?: Date;
}

const CheckInSchema = new Schema<ICheckIn>(
  {
    checkInId: { type: String, required: true, unique: true, maxlength: 50 },
    userId: { type: String, required: true, maxlength: 50 },
    passengerId: { type: String, required: true, maxlength: 50 },
    flightId: { type: String, required: true, maxlength: 20 },
    seatId: { type: String, maxlength: 10 },
    state: {
      type: String,
      required: true,
      enum: ['NOT_STARTED', 'IN_PROGRESS', 'AWAITING_PAYMENT', 'COMPLETED', 'CANCELLED'],
      default: 'NOT_STARTED',
    },
    baggage: {
      count: { type: Number, min: 0 },
      weights: [{ type: Number, min: 0 }],
      fee: { type: Number, min: 0 },
    },
    paymentUrl: { type: String },
    boardingPass: {
      qrCode: { type: String },
      gate: { type: String },
      boardingTime: { type: Date },
    },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Indexes
CheckInSchema.index({ checkInId: 1 }, { unique: true });
CheckInSchema.index({ passengerId: 1, flightId: 1 });
CheckInSchema.index({ userId: 1, createdAt: -1 });
CheckInSchema.index({ state: 1, createdAt: -1 });

export const CheckIn = mongoose.model<ICheckIn>('CheckIn', CheckInSchema);
