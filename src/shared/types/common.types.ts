export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export enum SeatState {
  AVAILABLE = 'AVAILABLE',
  HELD = 'HELD',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export enum CheckInState {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum SeatType {
  WINDOW = 'WINDOW',
  MIDDLE = 'MIDDLE',
  AISLE = 'AISLE',
}

export enum LoyaltyTier {
  PLATINUM = 'PLATINUM',
  GOLD = 'GOLD',
  SILVER = 'SILVER',
  REGULAR = 'REGULAR',
}
