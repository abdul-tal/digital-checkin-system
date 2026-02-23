import { v4 as uuid } from 'uuid';

export const generateId = (prefix?: string): string => {
  const id = uuid();
  return prefix ? `${prefix}_${id}` : id;
};

export const generateCheckInId = (): string => generateId('ci');
export const generateHoldId = (): string => generateId('hold');
export const generatePaymentId = (): string => generateId('pay');
export const generateWaitlistId = (): string => generateId('wl');
