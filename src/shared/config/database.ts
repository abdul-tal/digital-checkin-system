import mongoose from 'mongoose';
import { createLogger } from '../utils/logger';

const logger = createLogger('database');

export const connectDatabase = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/skyhigh';

  try {
    await mongoose.connect(uri, {
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '100'),
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '10'),
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('MongoDB connected successfully', { uri: uri.split('@')[1] });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
  } catch (error) {
    logger.error('MongoDB connection failed', { error });
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
};
