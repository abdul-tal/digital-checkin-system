import mongoose, { Schema, Document } from 'mongoose';

export interface IAccessLog extends Document {
  identifier: string;
  action: 'SEAT_MAP_ACCESS' | 'HOLD_SEAT' | 'BLOCKED' | 'CAPTCHA_REQUIRED';
  reason?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

const AccessLogSchema = new Schema<IAccessLog>({
  identifier: { type: String, required: true, maxlength: 100 },
  action: {
    type: String,
    required: true,
    enum: ['SEAT_MAP_ACCESS', 'HOLD_SEAT', 'BLOCKED', 'CAPTCHA_REQUIRED'],
  },
  reason: { type: String, maxlength: 200 },
  metadata: { type: Schema.Types.Mixed },
  timestamp: { type: Date, required: true, default: Date.now },
});

// TTL index - auto-delete after 30 days
AccessLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });
AccessLogSchema.index({ identifier: 1, timestamp: -1 });

export const AccessLog = mongoose.model<IAccessLog>('AccessLog', AccessLogSchema);
