import mongoose, { Schema, Document } from 'mongoose';

export interface IWaitlist extends Document {
  waitlistId: string;
  passengerId: string;
  flightId: string;
  seatId: string;
  priorityScore: number;
  loyaltyTier: 'PLATINUM' | 'GOLD' | 'SILVER' | 'REGULAR';
  createdAt: Date;
  expiresAt: Date;
}

const WaitlistSchema = new Schema<IWaitlist>(
  {
    waitlistId: { type: String, required: true, unique: true, maxlength: 50 },
    passengerId: { type: String, required: true, maxlength: 50 },
    flightId: { type: String, required: true, maxlength: 20 },
    seatId: { type: String, required: true, maxlength: 10 },
    priorityScore: { type: Number, required: true, min: 0 },
    loyaltyTier: {
      type: String,
      required: true,
      enum: ['PLATINUM', 'GOLD', 'SILVER', 'REGULAR'],
    },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

// Indexes
WaitlistSchema.index({ seatId: 1, priorityScore: -1 });
WaitlistSchema.index({ waitlistId: 1 }, { unique: true });
WaitlistSchema.index({ expiresAt: 1 });
WaitlistSchema.index({ passengerId: 1, flightId: 1, seatId: 1 }, { unique: true });

export const Waitlist = mongoose.model<IWaitlist>('Waitlist', WaitlistSchema);
