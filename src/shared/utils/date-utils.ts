export const addSeconds = (date: Date, seconds: number): Date => {
  return new Date(date.getTime() + seconds * 1000);
};

export const addMinutes = (date: Date, minutes: number): Date => {
  return new Date(date.getTime() + minutes * 60 * 1000);
};

export const addHours = (date: Date, hours: number): Date => {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
};

export const isExpired = (expiryDate: Date): boolean => {
  return new Date() > expiryDate;
};

export const getRemainingSeconds = (expiryDate: Date): number => {
  const remaining = Math.floor((expiryDate.getTime() - Date.now()) / 1000);
  return Math.max(0, remaining);
};

export const formatTimestamp = (date: Date): string => {
  return date.toISOString();
};
