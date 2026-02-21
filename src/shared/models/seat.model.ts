import mongoose, { Schema, Document } from 'mongoose';

export interface ISeat extends Document {
  seatId: string;
  flightId: string;
  rowNumber: number;
  columnLetter: string;
  seatType: 'WINDOW' | 'MIDDLE' | 'AISLE';
  state: 'AVAILABLE' | 'HELD' | 'CONFIRMED' | 'CANCELLED';
  heldByPassengerId?: string;
  holdExpiresAt?: Date;
  confirmedByPassengerId?: string;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}

const SeatSchema = new Schema<ISeat>(
  {
    seatId: { type: String, required: true, maxlength: 10 },
    flightId: { type: String, required: true, maxlength: 20 },
    rowNumber: { type: Number, required: true, min: 1 },
    columnLetter: { type: String, required: true, maxlength: 1 },
    seatType: {
      type: String,
      required: true,
      enum: ['WINDOW', 'MIDDLE', 'AISLE'],
    },
    state: {
      type: String,
      required: true,
      enum: ['AVAILABLE', 'HELD', 'CONFIRMED', 'CANCELLED'],
      default: 'AVAILABLE',
    },
    heldByPassengerId: { type: String, maxlength: 50 },
    holdExpiresAt: { type: Date },
    confirmedByPassengerId: { type: String, maxlength: 50 },
    price: { type: Number, required: true, min: 0 },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
SeatSchema.index({ flightId: 1, state: 1 });
SeatSchema.index({ seatId: 1, flightId: 1 }, { unique: true });
SeatSchema.index({ holdExpiresAt: 1 }, { partialFilterExpression: { state: 'HELD' } });
SeatSchema.index({ flightId: 1, seatType: 1, state: 1 });

export const Seat = mongoose.model<ISeat>('Seat', SeatSchema);
