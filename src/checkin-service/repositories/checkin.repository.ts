import { CheckIn, ICheckIn } from '../../shared/models/checkin.model';
import { FilterQuery, UpdateQuery } from 'mongoose';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('checkin-repository');

export class CheckInRepository {
  async create(data: Partial<ICheckIn>): Promise<ICheckIn> {
    const checkin = new CheckIn(data);
    await checkin.save();
    logger.debug('Check-in created', { checkInId: checkin.checkInId });
    return checkin;
  }

  async findOne(filter: FilterQuery<ICheckIn>): Promise<ICheckIn | null> {
    return CheckIn.findOne(filter);
  }

  async findById(checkInId: string): Promise<ICheckIn | null> {
    return CheckIn.findOne({ checkInId });
  }

  async updateOne(
    filter: FilterQuery<ICheckIn>,
    update: UpdateQuery<ICheckIn>
  ): Promise<void> {
    await CheckIn.updateOne(filter, update);
    logger.debug('Check-in updated', { filter });
  }

  async findByPassengerAndFlight(
    passengerId: string,
    flightId: string
  ): Promise<ICheckIn | null> {
    return CheckIn.findOne({ passengerId, flightId }).sort({ createdAt: -1 });
  }
}
